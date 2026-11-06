"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/freight";
import { secondaryClass } from "./shared";

export function QueryFeedback({
  error,
  hasData,
  fetching,
  updatedAt,
  retry,
}: {
  error: unknown;
  hasData: boolean;
  fetching: boolean;
  updatedAt: number;
  retry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!fetching || hasData) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [fetching, hasData]);

  if (error)
    return (
      <div
        role={hasData ? "status" : "alert"}
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${hasData ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {hasData
                ? "Couldn’t refresh this list"
                : "Couldn’t load this list"}
            </p>
            <p className="mt-1 text-xs">
              {hasData ? "Showing the last successfully loaded results. " : ""}
              {errorMessage(error)}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={secondaryClass}
          disabled={fetching}
          onClick={retry}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`}
          />
          {fetching ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  if (!hasData && fetching)
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl bg-[#f7f6fc] p-5 text-sm text-[#606174]"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>
          {slow
            ? "Taking longer than usual. Your workspace may be starting; we’re still trying."
            : "Loading requests…"}
        </span>
      </div>
    );
  return (
    <p
      className="mb-3 flex min-h-5 items-center gap-2 text-xs text-[#777884]"
      role="status"
    >
      {fetching ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing…
        </>
      ) : updatedAt ? (
        `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Updates automatically`
      ) : null}
    </p>
  );
}
