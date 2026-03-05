import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonViewer } from "@/components/json-viewer";
import { ReplayAlertsButton } from "@/components/replay-alerts-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSessionUser } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format";
import { db } from "@/lib/prisma";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const sessionUser = await requireSessionUser();

  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      alertRuns: {
        include: {
          rule: true,
        },
        orderBy: {
          firedAt: "desc",
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Event Detail</h2>
        <div className="flex items-center gap-2">
          {sessionUser.isAdmin ? <ReplayAlertsButton eventId={event.id} /> : null}
          <Link href="/events">
            <Button variant="outline" className="border-slate-600 bg-transparent text-slate-200">
              Back to Events
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>{event.type}</CardTitle>
          <CardDescription className="text-slate-300">Event ID: {event.id}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Source</p>
            <p className="text-sm text-slate-100">{event.source}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Received At</p>
            <p className="text-sm text-slate-100">{formatTimestamp(event.receivedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">External ID</p>
            <p className="text-sm text-slate-100">{event.externalId ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Signature</p>
            <Badge variant={event.signatureValid ? "success" : "destructive"}>
              {event.signatureValid ? "valid" : "invalid"}
            </Badge>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Dedupe Key</p>
            <p className="break-all font-mono text-xs text-slate-300">{event.dedupeKey}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">IP</p>
            <p className="text-sm text-slate-100">{event.ip ?? "-"}</p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">User Agent</p>
            <p className="break-all text-sm text-slate-100">{event.userAgent ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Payload</CardTitle>
          <CardDescription className="text-slate-300">Pretty JSON view</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonViewer data={event.payload} />
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Alert Runs</CardTitle>
          <CardDescription className="text-slate-300">Alert evaluations for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {event.alertRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {formatTimestamp(run.firedAt)}
                  </TableCell>
                  <TableCell>{run.rule.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "fired"
                          ? "success"
                          : run.status === "skipped_cooldown"
                            ? "warning"
                            : run.status === "disabled"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{run.note}</TableCell>
                </TableRow>
              ))}
              {event.alertRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No alert evaluations yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
