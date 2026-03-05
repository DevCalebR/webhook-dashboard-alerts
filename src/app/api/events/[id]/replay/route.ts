import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { type ReplayDb, replayEventAlerts } from "@/lib/replay";

interface ReplayRouteDeps {
  getSessionUser: typeof getSessionUser;
  replayDb: ReplayDb;
}

const defaultDependencies: ReplayRouteDeps = {
  getSessionUser,
  replayDb: db,
};

export async function handleReplayRoute(
  eventId: string,
  deps: ReplayRouteDeps = defaultDependencies,
): Promise<NextResponse> {
  const sessionUser = await deps.getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sessionUser.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await replayEventAlerts(eventId, deps.replayDb);

  if (!summary) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(summary, { status: 200 });
}

interface ReplayRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: ReplayRouteContext) {
  const { id } = await context.params;
  return handleReplayRoute(id);
}
