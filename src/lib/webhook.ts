import type { Event } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { evaluateAlertRulesForEvent, type AlertDb } from "@/lib/alerts";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";
import {
  computeRawBodyHash,
  sha256Hex,
  verifyGenericSignature,
  verifyStripeLikeSignature,
} from "@/lib/signature";

export type WebhookSource = "generic" | "stripe_like";

export interface WebhookDependencies {
  prisma: {
    event: {
      findUnique: (args: { where: { dedupeKey: string } }) => Promise<Event | null>;
      create: (args: {
        data: {
          source: string;
          receivedAt: Date;
          type: string;
          externalId: string | null;
          payload: Prisma.JsonObject;
          rawBodyHash: string;
          signatureValid: boolean;
          dedupeKey: string;
          ip: string | null;
          userAgent: string | null;
        };
      }) => Promise<Event>;
    };
  } & AlertDb;
  now: () => Date;
  rateLimiter: (key: string, limit: number, windowMs: number) => RateLimitResult;
}

const SUPPORTED_SOURCES = new Set<WebhookSource>(["generic", "stripe_like"]);

function isSupportedSource(source: string): source is WebhookSource {
  return SUPPORTED_SOURCES.has(source as WebhookSource);
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [ip] = forwardedFor.split(",");
    return ip.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function parsePayload(rawBody: string): Prisma.JsonObject | null {
  try {
    if (!rawBody.trim()) {
      return {};
    }

    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Prisma.JsonObject;
  } catch {
    return null;
  }
}

function extractType(payload: Prisma.JsonObject): string {
  const type = payload.type;
  return typeof type === "string" && type.length > 0 ? type : "unknown";
}

function extractExternalId(payload: Prisma.JsonObject): string | null {
  const value =
    payload.externalId ??
    payload.external_id ??
    payload.id ??
    (typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>).id
      : null);

  return typeof value === "string" && value.length > 0 ? value : null;
}

function getDedupeKey(
  source: WebhookSource,
  externalId: string | null,
  payload: Prisma.JsonObject,
): string {
  if (externalId) {
    return `${source}:${externalId}`;
  }

  return `${source}:${sha256Hex(JSON.stringify(payload))}`;
}

function verifySourceSignature(
  source: WebhookSource,
  rawBody: string,
  headers: Headers,
): { signatureValid: boolean; reason?: string } {
  if (source === "generic") {
    const headerSignature = headers.get("x-signature") ?? "";

    if (!headerSignature && env.webhookAllowUnsignedGeneric) {
      return { signatureValid: true, reason: "unsigned_allowed" };
    }

    const genericResult = verifyGenericSignature(
      rawBody,
      headerSignature,
      env.webhookGenericSecret,
    );

    return {
      signatureValid: genericResult.valid,
      reason: genericResult.reason,
    };
  }

  const stripeLikeHeader =
    headers.get("stripe-signature") ?? headers.get("x-stripe-signature") ?? "";

  const stripeLikeResult = verifyStripeLikeSignature(
    rawBody,
    stripeLikeHeader,
    env.webhookStripeLikeSecret,
  );

  return {
    signatureValid: stripeLikeResult.valid,
    reason: stripeLikeResult.reason,
  };
}

const defaultDependencies: WebhookDependencies = {
  prisma: db,
  now: () => new Date(),
  rateLimiter: (key, limit, windowMs) => checkRateLimit(key, limit, windowMs),
};

export async function handleWebhookRequest(
  request: Request,
  sourceParam: string,
  dependencies: Partial<WebhookDependencies> = {},
): Promise<NextResponse> {
  if (!isSupportedSource(sourceParam)) {
    return NextResponse.json(
      { error: "Unsupported source" },
      {
        status: 404,
      },
    );
  }

  const source = sourceParam;
  const deps: WebhookDependencies = {
    ...defaultDependencies,
    ...dependencies,
    prisma: dependencies.prisma ?? defaultDependencies.prisma,
  };

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const rateLimitResult = deps.rateLimiter(
    `${source}:${ip}`,
    env.webhookRateLimitMax,
    env.webhookRateLimitWindowMs,
  );

  if (!rateLimitResult.allowed) {
    logger.warn("webhook.rate_limited", {
      source,
      ip,
      resetAt: rateLimitResult.resetAt,
    });

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
      },
      {
        status: 429,
        headers: {
          "x-ratelimit-remaining": String(rateLimitResult.remaining),
          "x-ratelimit-reset": String(rateLimitResult.resetAt),
        },
      },
    );
  }

  const rawBody = await request.text();
  const payload = parsePayload(rawBody);

  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { signatureValid, reason } = verifySourceSignature(source, rawBody, request.headers);

  if (!signatureValid) {
    logger.warn("webhook.signature_invalid", {
      source,
      ip,
      reason,
    });

    return NextResponse.json(
      {
        error: "Invalid signature",
        reason,
      },
      {
        status: 401,
      },
    );
  }

  const type = extractType(payload);
  const externalId = extractExternalId(payload);
  const dedupeKey = getDedupeKey(source, externalId, payload);
  const rawBodyHash = computeRawBodyHash(rawBody);

  const existing = await deps.prisma.event.findUnique({ where: { dedupeKey } });
  if (existing) {
    logger.info("webhook.duplicate", {
      source,
      dedupeKey,
      eventId: existing.id,
    });

    return NextResponse.json(
      {
        duplicate: true,
        eventId: existing.id,
      },
      {
        status: 200,
      },
    );
  }

  try {
    const event = await deps.prisma.event.create({
      data: {
        source,
        receivedAt: deps.now(),
        type,
        externalId,
        payload,
        rawBodyHash,
        signatureValid,
        dedupeKey,
        ip,
        userAgent,
      },
    });

    const alertResult = await evaluateAlertRulesForEvent(event, deps.prisma);

    logger.info("webhook.ingested", {
      source,
      eventId: event.id,
      dedupeKey,
      signatureValid,
      alertRuns: alertResult.runs.length,
    });

    return NextResponse.json(
      {
        duplicate: false,
        eventId: event.id,
        signatureValid,
        alertRuns: alertResult.runs.map((run) => ({
          id: run.id,
          status: run.status,
          ruleId: run.ruleId,
        })),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    logger.error("webhook.ingest_failed", {
      source,
      message: error instanceof Error ? error.message : "unknown_error",
    });

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
