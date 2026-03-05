import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSessionUser } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format";
import { db } from "@/lib/prisma";

interface EventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getStringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function toDateOrNull(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toBooleanOrUndefined(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function buildPageHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value || key === "page") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const v of value) {
        search.append(key, v);
      }
      continue;
    }

    search.set(key, value);
  }

  search.set("page", String(page));
  return `/events?${search.toString()}`;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  await requireSessionUser();

  const params = await searchParams;
  const source = getStringParam(params, "source");
  const signatureValid = toBooleanOrUndefined(getStringParam(params, "signatureValid"));
  const query = getStringParam(params, "q");
  const from = toDateOrNull(getStringParam(params, "from"));
  const to = toDateOrNull(getStringParam(params, "to"));
  const page = Math.max(Number.parseInt(getStringParam(params, "page") || "1", 10) || 1, 1);

  const pageSize = 20;
  const where: Prisma.EventWhereInput = {};

  if (source) {
    where.source = source;
  }

  if (typeof signatureValid === "boolean") {
    where.signatureValid = signatureValid;
  }

  if (from || to) {
    where.receivedAt = {
      gte: from ?? undefined,
      lte: to ?? undefined,
    };
  }

  if (query) {
    where.OR = [
      {
        type: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        externalId: {
          contains: query,
          mode: "insensitive",
        },
      },
    ];
  }

  const [total, events, sources] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      include: {
        _count: {
          select: {
            alertRuns: true,
          },
        },
      },
      orderBy: {
        receivedAt: "desc",
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    db.event.findMany({
      distinct: ["source"],
      select: {
        source: true,
      },
      orderBy: {
        source: "asc",
      },
    }),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="space-y-6">
      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription className="text-slate-300">
            Filter webhook traffic by source, signature validity, date range, and type/external ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="source">
                Source
              </label>
              <Select defaultValue={source} id="source" name="source">
                <option value="">All</option>
                {sources.map((sourceEntry) => (
                  <option key={sourceEntry.source} value={sourceEntry.source}>
                    {sourceEntry.source}
                  </option>
                ))}
                <option value="generic">generic</option>
                <option value="stripe_like">stripe_like</option>
              </Select>
            </div>

            <div>
              <label
                className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
                htmlFor="signatureValid"
              >
                Signature
              </label>
              <Select
                defaultValue={getStringParam(params, "signatureValid")}
                id="signatureValid"
                name="signatureValid"
              >
                <option value="">All</option>
                <option value="true">Valid</option>
                <option value="false">Invalid</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="from">
                From
              </label>
              <Input id="from" name="from" type="datetime-local" defaultValue={getStringParam(params, "from")} />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="to">
                To
              </label>
              <Input id="to" name="to" type="datetime-local" defaultValue={getStringParam(params, "to")} />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400" htmlFor="q">
                Search
              </label>
              <Input id="q" name="q" placeholder="type or externalId" defaultValue={query} />
            </div>

            <div className="flex items-end gap-2 lg:col-span-5">
              <Button type="submit">Apply Filters</Button>
              <Link href="/events">
                <Button type="button" variant="outline" className="border-slate-600 bg-transparent text-slate-200">
                  Reset
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-900/90">
        <CardHeader>
          <CardTitle>Event Stream</CardTitle>
          <CardDescription className="text-slate-300">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Received</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Alert Runs</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {formatTimestamp(event.receivedAt)}
                  </TableCell>
                  <TableCell>{event.source}</TableCell>
                  <TableCell>{event.type}</TableCell>
                  <TableCell>{event.externalId ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={event.signatureValid ? "success" : "destructive"}>
                      {event.signatureValid ? "valid" : "invalid"}
                    </Badge>
                  </TableCell>
                  <TableCell>{event._count.alertRuns}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/events/${event.id}`}>
                      <Button size="sm" variant="outline" className="border-slate-600 bg-transparent text-slate-200">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 ? (
                <TableRow>
                  <TableCell className="text-slate-400" colSpan={7}>
                    No events matched the current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {hasPrev ? (
                <Link href={buildPageHref(params, page - 1)}>
                  <Button variant="outline" className="border-slate-600 bg-transparent text-slate-200">
                    Previous
                  </Button>
                </Link>
              ) : null}
              {hasNext ? (
                <Link href={buildPageHref(params, page + 1)}>
                  <Button variant="outline" className="border-slate-600 bg-transparent text-slate-200">
                    Next
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
