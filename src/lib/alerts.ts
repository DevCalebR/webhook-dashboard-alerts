import type { AlertRun, AlertRule } from "@prisma/client";

import { env } from "@/lib/env";
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

export interface SlackAlertPayload {
  text: string;
  eventId: string;
  ruleId: string;
  source: string;
  type: string;
  receivedAt: string;
}

export interface AlertEvaluationOptions {
  now?: Date;
  slackWebhookUrl?: string;
  postSlackWebhook?: (
    url: string,
    payload: SlackAlertPayload,
  ) => Promise<void>;
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

async function postSlackWebhook(
  url: string,
  payload: SlackAlertPayload,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }
}

async function deliverSlackForRule(
  rule: AlertRule,
  event: EventForAlerts,
  options: AlertEvaluationOptions,
): Promise<string | null> {
  if (rule.actionType !== "slack_webhook") {
    return null;
  }

  const slackWebhookUrl = options.slackWebhookUrl ?? env.alertSlackWebhookUrl;
  if (!slackWebhookUrl) {
    return "missing ALERT_SLACK_WEBHOOK_URL";
  }

  const payload: SlackAlertPayload = {
    text: `[Webhook Alerts] Rule ${rule.name} fired for ${event.source}:${event.type} (event ${event.id})`,
    eventId: event.id,
    ruleId: rule.id,
    source: event.source,
    type: event.type,
    receivedAt: event.receivedAt.toISOString(),
  };

  const send = options.postSlackWebhook ?? postSlackWebhook;

  try {
    await send(slackWebhookUrl, payload);
    return null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_slack_error";
    logger.warn("alerts.slack_failed", {
      eventId: event.id,
      ruleId: rule.id,
      message,
    });
    return message;
  }
}

export async function evaluateAlertRulesForEvent(
  event: EventForAlerts,
  alertDb: AlertDb = db,
  options: AlertEvaluationOptions = {},
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

  const now = options.now ?? new Date();
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

    const slackError = await deliverSlackForRule(rule, event, options);
    const note = slackError
      ? `Matched ${rule.matchType} rule; slack_failed: ${slackError}`
      : `Matched ${rule.matchType} rule`;

    const run = await alertDb.alertRun.create({
      data: {
        eventId: event.id,
        ruleId: rule.id,
        status: "fired",
        note,
      },
    });

    runs.push(run);
  }

  logger.info("alerts.evaluated", {
    eventId: event.id,
    source: event.source,
    totalRules: rules.length,
    fired: runs.filter((run) => run.status === "fired").length,
    slackFailures: runs.filter((run) => run.note.includes("slack_failed:")).length,
  });

  return { runs };
}
