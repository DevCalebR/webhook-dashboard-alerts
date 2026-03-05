import type { AlertRule, AlertRun, Event } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { createGenericSignature } from "@/lib/signature";
import { handleWebhookRequest, type WebhookDependencies } from "@/lib/webhook";

type MutableAlertRule = AlertRule;

function buildFakePrisma(seedRules: MutableAlertRule[]): WebhookDependencies["prisma"] {
  const events: Event[] = [];
  const rules = [...seedRules];
  const runs: AlertRun[] = [];

  return {
    event: {
      async findUnique({ where }) {
        return events.find((event) => event.dedupeKey === where.dedupeKey) ?? null;
      },
      async create({ data }) {
        const event: Event = {
          id: `evt_${events.length + 1}`,
          ...data,
        };
        events.push(event);
        return event;
      },
    },
    alertRule: {
      async findMany({ where }) {
        const allowedSources = where.source.in;
        return rules.filter((rule) => allowedSources.includes(rule.source));
      },
      async update({ where, data }) {
        const rule = rules.find((item) => item.id === where.id);
        if (!rule) {
          throw new Error("Rule not found");
        }

        rule.lastFiredAt = data.lastFiredAt;
        rule.updatedAt = data.lastFiredAt;
        return rule;
      },
    },
    alertRun: {
      async create({ data }) {
        const run: AlertRun = {
          id: `run_${runs.length + 1}`,
          firedAt: new Date(),
          ...data,
        };
        runs.push(run);
        return run;
      },
    },
  };
}

function createRule(overrides: Partial<AlertRule> = {}): AlertRule {
  const now = new Date("2025-01-01T00:00:00.000Z");

  return {
    id: overrides.id ?? "rule_1",
    name: overrides.name ?? "Invoice paid",
    enabled: overrides.enabled ?? true,
    source: overrides.source ?? "generic",
    matchType: overrides.matchType ?? "prefix",
    matchValue: overrides.matchValue ?? "invoice.",
    actionType: overrides.actionType ?? "db_only",
    cooldownSeconds: overrides.cooldownSeconds ?? 0,
    lastFiredAt: overrides.lastFiredAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe("POST /api/webhooks/[source] integration", () => {
  it("ingests a signed generic event, evaluates alerts, and dedupes duplicates", async () => {
    const fakePrisma = buildFakePrisma([createRule()]);
    const payload = {
      id: "evt_test_1",
      type: "invoice.paid",
      amount: 4200,
    };
    const rawBody = JSON.stringify(payload);
    const signature = createGenericSignature(rawBody, "dev_generic_secret");

    const requestOne = new Request("http://localhost/api/webhooks/generic", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-forwarded-for": "127.0.0.1",
      },
      body: rawBody,
    });

    const responseOne = await handleWebhookRequest(requestOne, "generic", {
      prisma: fakePrisma,
      rateLimiter: () => ({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60_000,
      }),
      now: () => new Date("2025-02-01T12:00:00.000Z"),
    });

    const bodyOne = await responseOne.json();

    expect(responseOne.status).toBe(200);
    expect(bodyOne.duplicate).toBe(false);
    expect(bodyOne.alertRuns).toHaveLength(1);
    expect(bodyOne.alertRuns[0].status).toBe("fired");

    const requestTwo = new Request("http://localhost/api/webhooks/generic", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
      },
      body: rawBody,
    });

    const responseTwo = await handleWebhookRequest(requestTwo, "generic", {
      prisma: fakePrisma,
      rateLimiter: () => ({
        allowed: true,
        remaining: 98,
        resetAt: Date.now() + 60_000,
      }),
      now: () => new Date("2025-02-01T12:00:01.000Z"),
    });

    const bodyTwo = await responseTwo.json();

    expect(responseTwo.status).toBe(200);
    expect(bodyTwo.duplicate).toBe(true);
  });
});
