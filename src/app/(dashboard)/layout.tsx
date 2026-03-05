import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSessionUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionUser = await requireSessionUser();

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/90 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-300">Webhook Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-100">Alerts Console</h1>
          <p className="text-sm text-slate-400">Signed ingestion, dedupe, and rule-based automation.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/events">
            <Button variant="secondary">Events</Button>
          </Link>
          <Link href="/alerts">
            <Button variant="secondary">Alerts</Button>
          </Link>
          <Badge variant={sessionUser.isAdmin ? "success" : "outline"}>
            {sessionUser.isAdmin ? "Admin" : "Member"}
          </Badge>
          {sessionUser.bypass ? (
            <Badge variant="warning">DEV_BYPASS_AUTH</Badge>
          ) : (
            <UserButton />
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
