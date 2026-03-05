import type { AlertRule, AlertRun } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { handleReplayRoute } from "@/app/api/events/[id]/replay/route";
import type { SessionUser } from "@/lib/auth";
import type { ReplayDb } from "@/lib/replay";

function createRule(overrides: Partial<AlertRule> = {}): AlertRule {
  const now = new Date("2026-03-05T00:00:00.000Z");

  return {
    id: overrides.id ?? "rule_replay_1",
    name: overrides.name ?? "Replay invoice",
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

function buildReplayDb(event: {
  id: string;
  source: string;
  type: string;
  receivedAt: Date;
}): {
  replayDb: ReplayDb;
  runs: AlertRun[];
} {
  const rules = [createRule()];
  const runs: AlertRun[] = [];

  const replayDb: ReplayDb = {
    event: {
      async findUnique({ where }) {
        return where.id === event.id ? event : null;
      },
    },
    alertRule: {
      async findMany({ where }) {
        const allowedSources = where.source.in;
        return rules.filter((rule) => allowedSources.includes(rule.source));
      },
      async update({ where, data }) {
        const rule = rules.find((entry) => entry.id === where.id);
        if (!rule) {
          throw new Error("Rule not found");
        }

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

  return { replayDb, runs };
}

function makeUser(isAdmin: boolean): SessionUser {
  return {
    clerkUserId: "clerk_replay",
    email: "admin@example.com",
    isAdmin,
    bypass: false,
  };
}

describe("POST /api/events/[id]/replay integration", () => {
  it("replays alerts for admin users and returns summary", async () => {
    const event = {
      id: "evt_replay_1",
      source: "generic",
      type: "invoice.paid",
      receivedAt: new Date("2026-03-05T01:00:00.000Z"),
    };

    const { replayDb, runs } = buildReplayDb(event);

    const response = await handleReplayRoute(event.id, {
      getSessionUser: async () => makeUser(true),
      replayDb,
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      eventId: "evt_replay_1",
      evaluatedRules: 1,
      fired: 1,
      runsCreated: 1,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("fired");
  });

  it("returns forbidden for non-admin users", async () => {
    const { replayDb } = buildReplayDb({
      id: "evt_replay_2",
      source: "generic",
      type: "invoice.paid",
      receivedAt: new Date("2026-03-05T01:00:00.000Z"),
    });

    const response = await handleReplayRoute("evt_replay_2", {
      getSessionUser: async () => makeUser(false),
      replayDb,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
});
