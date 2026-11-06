"use client";
import { useRef } from "react";

// Keep IDs after a lost response; retrying the same form cannot create duplicate work.
export function usePartnerCommandIds() {
  const intents = useRef(
    new Map<
      string,
      { command_id: string; task_id: string; enquiry_id: string }
    >(),
  );
  const allocate = (body: unknown) => {
    const key = JSON.stringify(body);
    let value = intents.current.get(key);
    if (!value) {
      value = {
        command_id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
        enquiry_id: crypto.randomUUID(),
      };
      intents.current.set(key, value);
    }
    return value;
  };
  return Object.assign(allocate, {
    complete: (body: unknown) => intents.current.delete(JSON.stringify(body)),
  });
}
