import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAlertRuleAction, toggleAlertRuleAction, updateAlertRuleAction } from "@/app/(dashboard)/alerts/actions";
import { requireSessionUser } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format";
import { db } from "@/lib/prisma";

export default async function AlertsPage() {
  const sessionUser = await requireSessionUser();

  const [rules, runs] = await Promise.all([
    db.alertRule.findMany({
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.alertRun.findMany({
      include: {
        rule: {
          select: {
            name: true,
          },
        },
        event: {
          select: {
            type: true,
            source: true,
          },
        },
      },
      orderBy: {
        firedAt: "desc",
      },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription className="text-slate-300">
            Rules evaluate synchronously during webhook ingestion. Production scale should move this to a queue worker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionUser.isAdmin ? (
            <form action={createAlertRuleAction} className="grid gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="name">
                  Name
                </label>
                <Input id="name" name="name" placeholder="High value payments" required />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="source">
                  Source
                </label>
                <Input id="source" name="source" defaultValue="*" required />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="matchType">
                  Match Type
                </label>
                <Select id="matchType" name="matchType" defaultValue="prefix">
                  <option value="exact">exact</option>
                  <option value="prefix">prefix</option>
                  <option value="contains">contains</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="matchValue">
                  Match Value
                </label>
                <Input id="matchValue" name="matchValue" placeholder="invoice." required />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="actionType">
                  Action
                </label>
                <Select id="actionType" name="actionType" defaultValue="db_only">
                  <option value="db_only">db_only</option>
                  <option value="slack_webhook">slack_webhook</option>
                </Select>
              </div>
              <div>
                <label
                  className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
                  htmlFor="cooldownSeconds"
                >
                  Cooldown Seconds
                </label>
                <Input id="cooldownSeconds" name="cooldownSeconds" type="number" defaultValue="60" min={0} />
              </div>
              <div className="lg:col-span-6">
                <Button type="submit">Create Rule</Button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              You can view rules, but only admins can create or edit rules.
            </div>
          )}

          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{rule.name}</h3>
                    <Badge variant={rule.enabled ? "success" : "outline"}>
                      {rule.enabled ? "enabled" : "disabled"}
                    </Badge>
                    <Badge variant="secondary">{rule.actionType}</Badge>
                  </div>
                  {sessionUser.isAdmin ? (
                    <form action={toggleAlertRuleAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="enabled" value={String(!rule.enabled)} />
                      <Button type="submit" size="sm" variant="outline" className="border-slate-500 bg-transparent text-slate-200">
                        {rule.enabled ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  ) : null}
                </div>

                {sessionUser.isAdmin ? (
                  <form action={updateAlertRuleAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <input type="hidden" name="id" value={rule.id} />
                    <div className="lg:col-span-2">
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`name-${rule.id}`}>
                        Name
                      </label>
                      <Input id={`name-${rule.id}`} name="name" defaultValue={rule.name} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`source-${rule.id}`}>
                        Source
                      </label>
                      <Input id={`source-${rule.id}`} name="source" defaultValue={rule.source} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`matchType-${rule.id}`}>
                        Match Type
                      </label>
                      <Select id={`matchType-${rule.id}`} name="matchType" defaultValue={rule.matchType}>
                        <option value="exact">exact</option>
                        <option value="prefix">prefix</option>
                        <option value="contains">contains</option>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`matchValue-${rule.id}`}>
                        Match Value
                      </label>
                      <Input id={`matchValue-${rule.id}`} name="matchValue" defaultValue={rule.matchValue} required />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor={`actionType-${rule.id}`}>
                        Action
                      </label>
                      <Select id={`actionType-${rule.id}`} name="actionType" defaultValue={rule.actionType}>
                        <option value="db_only">db_only</option>
                        <option value="slack_webhook">slack_webhook</option>
                      </Select>
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
                        htmlFor={`cooldown-${rule.id}`}
                      >
                        Cooldown
                      </label>
                      <Input
                        id={`cooldown-${rule.id}`}
                        name="cooldownSeconds"
                        type="number"
                        min={0}
                        defaultValue={String(rule.cooldownSeconds)}
                      />
                    </div>
                    <div className="flex items-end gap-2 lg:col-span-6">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          name="enabled"
                          defaultChecked={rule.enabled}
                        />
                        Enabled
                      </label>
                      <Button type="submit" size="sm">
                        Save Rule
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="grid gap-1 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                    <p>Source: {rule.source}</p>
                    <p>
                      Match: {rule.matchType} {rule.matchValue}
                    </p>
                    <p>Action: {rule.actionType}</p>
                    <p>Cooldown: {rule.cooldownSeconds}s</p>
                    <p>Last Fired: {rule.lastFiredAt ? formatTimestamp(rule.lastFiredAt) : "never"}</p>
                  </div>
                )}
              </div>
            ))}

            {rules.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-400">
                No alert rules yet.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Recent Alert Runs</CardTitle>
          <CardDescription className="text-slate-300">Latest 50 evaluations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Event Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs text-slate-300">{formatTimestamp(run.firedAt)}</TableCell>
                  <TableCell>{run.rule.name}</TableCell>
                  <TableCell>
                    {run.event.source} / {run.event.type}
                  </TableCell>
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
                  <TableCell className="text-right">
                    <Link href={`/events/${run.eventId}`}>
                      <Button size="sm" variant="outline" className="border-slate-600 bg-transparent text-slate-200">
                        View Event
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>No alert runs yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
