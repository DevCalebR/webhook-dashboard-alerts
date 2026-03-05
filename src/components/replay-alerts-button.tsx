"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

interface ReplayAlertsButtonProps {
  eventId: string;
}

export function ReplayAlertsButton({ eventId }: ReplayAlertsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const replay = () => {
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/replay`, {
          method: "POST",
        });

        const body = (await response.json()) as {
          error?: string;
          evaluatedRules?: number;
          fired?: number;
          runsCreated?: number;
        };

        if (!response.ok) {
          setError(body.error ?? "Replay failed");
          return;
        }

        setMessage(
          `Replay complete: evaluated ${body.evaluatedRules}, fired ${body.fired}, runs created ${body.runsCreated}`,
        );
      } catch (fetchError) {
        setError(
          fetchError instanceof Error ? fetchError.message : "Replay request failed",
        );
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={replay}
        disabled={isPending}
        variant="outline"
        className="border-slate-600 bg-transparent text-slate-200"
      >
        {isPending ? "Replaying..." : "Replay Alerts"}
      </Button>
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
