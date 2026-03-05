"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

const createRuleSchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  matchType: z.enum(["exact", "prefix", "contains"]),
  matchValue: z.string().min(1),
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400),
});

const updateRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  matchType: z.enum(["exact", "prefix", "contains"]),
  matchValue: z.string().min(1),
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400),
  enabled: z.boolean(),
});

export async function createAlertRuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const parsed = createRuleSchema.safeParse({
    name: formData.get("name"),
    source: formData.get("source"),
    matchType: formData.get("matchType"),
    matchValue: formData.get("matchValue"),
    cooldownSeconds: formData.get("cooldownSeconds"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert rule data");
  }

  await db.alertRule.create({
    data: {
      ...parsed.data,
      actionType: "db_only",
      enabled: true,
    },
  });

  revalidatePath("/alerts");
}

export async function updateAlertRuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const parsed = updateRuleSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    source: formData.get("source"),
    matchType: formData.get("matchType"),
    matchValue: formData.get("matchValue"),
    cooldownSeconds: formData.get("cooldownSeconds"),
    enabled: formData.get("enabled") === "on",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert rule update");
  }

  const { id, ...data } = parsed.data;

  await db.alertRule.update({
    where: { id },
    data,
  });

  revalidatePath("/alerts");
}

export async function toggleAlertRuleAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";

  if (!id) {
    throw new Error("Missing rule id");
  }

  await db.alertRule.update({
    where: { id },
    data: { enabled },
  });

  revalidatePath("/alerts");
}
