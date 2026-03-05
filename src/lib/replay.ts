import type { Event } from "@prisma/client";

import { type AlertDb, evaluateAlertRulesForEvent } from "@/lib/alerts";
import { db } from "@/lib/prisma";

type ReplayableEvent = Pick<Event, "id" | "source" | "type" | "receivedAt">;

export interface ReplayDb extends AlertDb {
  event: {
    findUnique: (args: { where: { id: string } }) => Promise<ReplayableEvent | null>;
  };
}

export interface ReplaySummary {
  eventId: string;
  evaluatedRules: number;
  fired: number;
  runsCreated: number;
}

export async function replayEventAlerts(
  eventId: string,
  replayDb: ReplayDb = db,
): Promise<ReplaySummary | null> {
  const event = await replayDb.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return null;
  }

  const result = await evaluateAlertRulesForEvent(event, replayDb);
  const fired = result.runs.filter((run) => run.status === "fired").length;

  return {
    eventId: event.id,
    evaluatedRules: result.runs.length,
    fired,
    runsCreated: result.runs.length,
  };
}
