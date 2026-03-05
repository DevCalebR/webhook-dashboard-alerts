import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const now = new Date();

  await prisma.alertRun.deleteMany();
  await prisma.event.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.userProfile.deleteMany({ where: { clerkUserId: "seed-admin" } });

  await prisma.userProfile.create({
    data: {
      clerkUserId: "seed-admin",
      email: adminEmail,
      role: UserRole.ADMIN,
    },
  });

  const invoiceRule = await prisma.alertRule.create({
    data: {
      name: "Invoice paid events",
      source: "generic",
      matchType: "prefix",
      matchValue: "invoice.",
      actionType: "db_only",
      cooldownSeconds: 60,
      enabled: true,
      lastFiredAt: null,
    },
  });

  const failureRule = await prisma.alertRule.create({
    data: {
      name: "Any failed event",
      source: "*",
      matchType: "contains",
      matchValue: "failed",
      actionType: "db_only",
      cooldownSeconds: 0,
      enabled: true,
      lastFiredAt: null,
    },
  });

  const event = await prisma.event.create({
    data: {
      source: "generic",
      type: "invoice.paid",
      externalId: "seed_evt_1",
      payload: {
        id: "seed_evt_1",
        type: "invoice.paid",
        amount: 2500,
      },
      rawBodyHash: "seedhash1",
      signatureValid: true,
      dedupeKey: "generic:seed_evt_1",
      ip: "127.0.0.1",
      userAgent: "seed-script",
      receivedAt: now,
    },
  });

  await prisma.alertRule.update({
    where: { id: invoiceRule.id },
    data: { lastFiredAt: now },
  });

  await prisma.alertRun.createMany({
    data: [
      {
        ruleId: invoiceRule.id,
        eventId: event.id,
        status: "fired",
        note: "Matched prefix rule",
        firedAt: now,
      },
      {
        ruleId: failureRule.id,
        eventId: event.id,
        status: "no_match",
        note: "Event type invoice.paid did not match contains",
        firedAt: now,
      },
    ],
  });

  console.log("Seed complete: rules, event, and alert runs inserted.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
