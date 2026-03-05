import type { AlertRun, AlertRule } from "@prisma/client";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";

export interface EventForAlerts {
  id: string;
  source: string;
  type: string;
  receivedAt: Date;
}

export interface AlertDb {
  alertRule: {
    findMany: (args: {
      where: { source: { in: string[] } };
      orderBy: { createdAt: "asc" | "desc" };
    }) => Promise<AlertRule[]>;
    update: (args: {
      where: { id: string };
      data: { lastFiredAt: Date };
    }) => Promise<AlertRule>;
  };
  alertRun: {
    create: (args: {
      data: {
        eventId: string;
        ruleId: string;
        status: "fired" | "skipped_cooldown" | "disabled" | "no_match";
        note: string;
      };
    }) => Promise<AlertRun>;
  };
}

export interface AlertEvaluationResult {
  runs: AlertRun[];
}

function ruleMatchesEventType(rule: AlertRule, eventType: string): boolean {
  if (rule.matchType === "exact") {
    return eventType === rule.matchValue;
  }

  if (rule.matchType === "prefix") {
    return eventType.startsWith(rule.matchValue);
  }

  return eventType.includes(rule.matchValue);
}

function isCooldownActive(rule: AlertRule, now: Date): boolean {
  if (!rule.lastFiredAt || rule.cooldownSeconds <= 0) {
    return false;
  }

  const elapsedSeconds = (now.getTime() - rule.lastFiredAt.getTime()) / 1000;
  return elapsedSeconds < rule.cooldownSeconds;
}

export async function evaluateAlertRulesForEvent(
  event: EventForAlerts,
  alertDb: AlertDb = db,
): Promise<AlertEvaluationResult> {
  const rules = await alertDb.alertRule.findMany({
    where: {
      source: {
        in: [event.source, "*"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const now = new Date();
  const runs: AlertRun[] = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      const run = await alertDb.alertRun.create({
        data: {
          eventId: event.id,
          ruleId: rule.id,
          status: "disabled",
          note: "Rule disabled",
        },
      });
      runs.push(run);
      continue;
    }

    if (!ruleMatchesEventType(rule, event.type)) {
      const run = await alertDb.alertRun.create({
        data: {
          eventId: event.id,
          ruleId: rule.id,
          status: "no_match",
          note: `Event type ${event.type} did not match ${rule.matchType}`,
        },
      });
      runs.push(run);
      continue;
    }

    if (isCooldownActive(rule, now)) {
      const run = await alertDb.alertRun.create({
        data: {
          eventId: event.id,
          ruleId: rule.id,
          status: "skipped_cooldown",
          note: `Cooldown active (${rule.cooldownSeconds}s)`,
        },
      });
      runs.push(run);
      continue;
    }

    await alertDb.alertRule.update({
      where: { id: rule.id },
      data: { lastFiredAt: now },
    });

    const run = await alertDb.alertRun.create({
      data: {
        eventId: event.id,
        ruleId: rule.id,
        status: "fired",
        note: `Matched ${rule.matchType} rule`,
      },
    });

    runs.push(run);
  }

  logger.info("alerts.evaluated", {
    eventId: event.id,
    source: event.source,
    totalRules: rules.length,
    fired: runs.filter((run) => run.status === "fired").length,
  });

  return { runs };
}
