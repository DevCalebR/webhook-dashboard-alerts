import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
      <Card className="w-full border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle className="text-3xl">Webhook Dashboard Alerts</CardTitle>
          <CardDescription className="text-slate-300">
            Ingest signed webhooks, inspect events, and run rule-based alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/events">
            <Button>Open Dashboard</Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="secondary">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="outline" className="border-slate-500 bg-transparent text-slate-100">
              Create Account
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
