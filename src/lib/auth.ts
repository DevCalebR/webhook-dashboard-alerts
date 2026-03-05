import { auth, currentUser } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { db } from "@/lib/prisma";

export interface SessionUser {
  clerkUserId: string;
  email: string;
  isAdmin: boolean;
  bypass: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function syncUserProfile(
  clerkUserId: string,
  email: string,
): Promise<{ role: UserRole }> {
  const normalizedEmail = normalizeEmail(email);
  const shouldBeAdmin = normalizedEmail === env.adminEmail;

  return db.userProfile.upsert({
    where: {
      clerkUserId,
    },
    update: {
      email: normalizedEmail,
      role: shouldBeAdmin ? UserRole.ADMIN : undefined,
    },
    create: {
      clerkUserId,
      email: normalizedEmail,
      role: shouldBeAdmin ? UserRole.ADMIN : UserRole.USER,
    },
    select: {
      role: true,
    },
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (env.devBypassAuth) {
    return {
      clerkUserId: "dev-bypass",
      email: env.adminEmail,
      isAdmin: true,
      bypass: true,
    };
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const email = user?.emailAddresses.at(0)?.emailAddress;

  if (!email) {
    return null;
  }

  const profile = await syncUserProfile(userId, email);

  return {
    clerkUserId: userId,
    email: normalizeEmail(email),
    isAdmin: profile.role === UserRole.ADMIN,
    bypass: false,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/sign-in");
  }

  return sessionUser;
}

export async function requireAdminUser(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();

  if (!sessionUser.isAdmin) {
    throw new Error("Admin privileges required");
  }

  return sessionUser;
}
