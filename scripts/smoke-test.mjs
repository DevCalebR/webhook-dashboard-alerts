import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const projectRoot = process.cwd();

const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

const port = Number.parseInt(process.env.SMOKE_PORT ?? "4010", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const genericSecret = process.env.WEBHOOK_GENERIC_SECRET ?? "dev_generic_secret";

function signGenericPayload(rawBody) {
  return crypto.createHmac("sha256", genericSecret).update(rawBody).digest("hex");
}

async function waitForHealthy(url, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const prisma = new PrismaClient();

  const serverEnv = {
    ...process.env,
    PORT: String(port),
    DEV_BYPASS_AUTH: "true",
  };

  const server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: projectRoot,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    process.stdout.write(`[dev] ${chunk.toString()}`);
  });

  server.stderr.on("data", (chunk) => {
    process.stderr.write(`[dev:err] ${chunk.toString()}`);
  });

  try {
    await waitForHealthy(`${baseUrl}/api/health`);

    const smokeRuleName = "smoke generic invoice";
    const smokeExternalId = "smoke_evt_1";

    await prisma.alertRun.deleteMany();
    await prisma.event.deleteMany({ where: { externalId: smokeExternalId } });
    await prisma.alertRule.deleteMany({ where: { name: smokeRuleName } });

    await prisma.alertRule.create({
      data: {
        name: smokeRuleName,
        source: "generic",
        matchType: "prefix",
        matchValue: "invoice.",
        actionType: "db_only",
        cooldownSeconds: 0,
        enabled: true,
      },
    });

    const payload = {
      id: smokeExternalId,
      type: "invoice.paid",
      amount: 1337,
      currency: "USD",
    };
    const rawBody = JSON.stringify(payload);
    const signature = signGenericPayload(rawBody);

    const webhookResponse = await fetch(`${baseUrl}/api/webhooks/generic`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
      },
      body: rawBody,
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook request failed with status ${webhookResponse.status}`);
    }

    const webhookJson = await webhookResponse.json();
    if (webhookJson.duplicate !== false) {
      throw new Error("Webhook response did not indicate a new event insert");
    }

    await sleep(800);

    const event = await prisma.event.findFirst({
      where: { externalId: smokeExternalId },
      orderBy: { receivedAt: "desc" },
    });

    if (!event) {
      throw new Error("Event was not written to the database");
    }

    const alertRun = await prisma.alertRun.findFirst({
      where: {
        eventId: event.id,
        status: "fired",
      },
      orderBy: { firedAt: "desc" },
    });

    if (!alertRun) {
      throw new Error("No fired alert run found for smoke event");
    }

    const eventsHtml = await fetch(`${baseUrl}/events`).then((response) => response.text());
    if (!eventsHtml.includes(smokeExternalId)) {
      throw new Error("Smoke event not visible on /events page");
    }

    const alertsHtml = await fetch(`${baseUrl}/alerts`).then((response) => response.text());
    if (!alertsHtml.includes("fired") && !alertsHtml.includes("smoke generic invoice")) {
      throw new Error("Fired alert not visible on /alerts page");
    }

    console.log("Smoke test passed: app booted, webhook ingested, event listed, alert fired.");
  } finally {
    await prisma.$disconnect();

    if (!server.killed) {
      server.kill("SIGTERM");
      await sleep(1_000);
      if (!server.killed) {
        server.kill("SIGKILL");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
