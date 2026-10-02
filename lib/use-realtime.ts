"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./auth-store";

// FastAPI JWTs do not authenticate Supabase's anonymous Realtime connection.
// Refresh operational lists through the same authorized API as normal reads.
export function useRealtime() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      queryClient.invalidateQueries({ predicate: query => {
        const key = query.queryKey;
        return ["shipments", "dashboard", "exceptions", "approvals"].includes(String(key[0])) ||
          (key[0] === "freight" && key[1] === user.tenant_id &&
           ["overview", "dashboard", "jobs", "rfqs", "alerts", "documents", "workload"].includes(String(key[2])));
      }, refetchType: "active" });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [queryClient, user]);
}
