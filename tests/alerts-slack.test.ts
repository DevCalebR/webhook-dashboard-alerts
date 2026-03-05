import type { AlertRule, AlertRun } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AlertDb, evaluateAlertRulesForEvent } from "@/lib/alerts";

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  const now = new Date("2026-03-05T00:00:00.000Z");

  return {
    id: overrides.id ?? "rule_slack_1",
    name: overrides.name ?? "Slack invoice alerts",
    enabled: overrides.enabled ?? true,
    source: overrides.source ?? "generic",
    matchType: overrides.matchType ?? "prefix",
    matchValue: overrides.matchValue ?? "invoice.",
    actionType: overrides.actionType ?? "slack_webhook",
    cooldownSeconds: overrides.cooldownSeconds ?? 0,
    lastFiredAt: overrides.lastFiredAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function buildFakeAlertDb(rule: AlertRule): {
  alertDb: AlertDb;
  runs: AlertRun[];
} {
  const runs: AlertRun[] = [];

  const alertDb: AlertDb = {
    alertRule: {
      async findMany() {
        return [rule];
      },
      async update({ data }) {
        rule.lastFiredAt = data.lastFiredAt;
        return rule;
      },
    },
    alertRun: {
      async create({ data }) {
        const run: AlertRun = {
          id: `run_${runs.length + 1}`,
          firedAt: new Date("2026-03-05T01:00:00.000Z"),
          ...data,
        };
        runs.push(run);
        return run;
      },
    },
  };

  return { alertDb, runs };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("evaluateAlertRulesForEvent slack delivery", () => {
  it("posts to Slack webhook when a slack_webhook rule fires", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { alertDb, runs } = buildFakeAlertDb(makeRule());

    const event = {
      id: "evt_slack_1",
      source: "generic",
      type: "invoice.paid",
      receivedAt: new Date("2026-03-05T02:00:00.000Z"),
    };

    await evaluateAlertRulesForEvent(event, alertDb, {
      now: new Date("2026-03-05T02:00:00.000Z"),
      slackWebhookUrl: "https://hooks.slack.test/services/T000/B000/XXX",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.test/services/T000/B000/XXX",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      text: string;
      eventId: string;
      ruleId: string;
      source: string;
      type: string;
      receivedAt: string;
    };

    expect(body.text).toBe(
      "[Webhook Alerts] Rule Slack invoice alerts fired for generic:invoice.paid (event evt_slack_1)",
    );
    expect(body.eventId).toBe("evt_slack_1");
    expect(body.ruleId).toBe("rule_slack_1");
    expect(body.source).toBe("generic");
    expect(body.type).toBe("invoice.paid");
    expect(body.receivedAt).toBe("2026-03-05T02:00:00.000Z");

    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("fired");
    expect(runs[0]?.note).toBe("Matched prefix rule");
  });
});
