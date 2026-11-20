"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { freight } from "@/lib/freight";
import {
  managerRoles,
  operationalRoles,
  partnerNetwork,
  type Partner,
} from "@/lib/partner-network";
import {
  Panel,
  Field,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "./shared";
export function PartnerDirectory() {
  const user = useAuthStore((state) => state.user),
    client = useQueryClient();
  const [search, setSearch] = useState(""),
    [capability, setCapability] = useState("");
  const [selected, setSelected] = useState<Partner | null>(null),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const result = useQuery<Partner[]>({
    queryKey: [
      "partner-network",
      user?.tenant_id,
      user?.id,
      "directory",
      search,
      capability,
    ],
    queryFn: () => partnerNetwork.partners(search, capability),
    enabled: !!user,
    refetchInterval: (query) => (query.state.error ? 60000 : 15000),
  });
  const partnersData: Partner[] | undefined = result.data;
  const canOperate = operationalRoles.includes(user?.role || ""),
    canApprove = managerRoles.includes(user?.role || "");
  async function relationship(partner: Partner, action: string) {
    setBusy(true);
    setError(null);
    try {
      await freight.post(`/partners/${partner.id}/relationship`, {
        command_id: crypto.randomUUID(),
        action,
      });
      toast.success("Partner update queued");
      await client.invalidateQueries({
        queryKey: ["partner-network", user?.tenant_id],
      });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <Panel title="Discover partners">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name, coverage area or port">
            <input
              className={inputClass}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Service">
            <select
              className={inputClass}
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            >
              <option value="">All services</option>
              <option value="pickup_delivery">Pickup and delivery</option>
              <option value="customs">Customs clearance</option>
              <option value="warehouse_owner">Warehousing</option>
            </select>
          </Field>
        </div>
        <ErrorBanner error={result.error || error} />
        {result.isLoading && <p className="mt-5 text-sm">Loading partners…</p>}
        {partnersData?.length === 0 && (
          <p className="mt-5 text-sm">No matching partners.</p>
        )}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {partnersData?.map((partner) => (
            <article key={partner.id} className="rounded-xl border p-4">
              <div className="flex justify-between gap-3">
                <h3 className="text-sm font-semibold">{partner.name}</h3>
                <span className="text-xs text-[#7068cf]">
                  {partner.relationship?.status || "New partner"}
                </span>
              </div>
              <p className="mt-2 text-xs">
                {partner.capabilities
                  .map((value) => value.replaceAll("_", " "))
                  .join(" · ")}
              </p>
              <p className="mt-2 text-xs text-[#777884]">
                Coverage:{" "}
                {partner.coverage.join(", ") || "Contact for coverage"}
              </p>
              <p className="text-xs">Ports: {partner.ports.join(", ")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canOperate && (
                  <button
                    className={secondaryClass}
                    onClick={() => {
                      setSelected(partner);
                      setMessage("");
                    }}
                  >
                    Send enquiry
                  </button>
                )}
                {canApprove && partner.relationship?.status !== "approved" && (
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => relationship(partner, "approve")}
                  >
                    Approve for our company
                  </button>
                )}
                {canApprove && partner.relationship?.status === "approved" && (
                  <button
                    className={secondaryClass}
                    disabled={busy}
                    onClick={() => relationship(partner, "suspend")}
                  >
                    Suspend relationship
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      {selected && (
        <Panel title={`Enquiry to ${selected.name}`}>
          <textarea
            className={inputClass}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
          />
          <div className="mt-4 flex gap-3">
            <button
              className={buttonClass}
              disabled={busy || !message.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await freight.post(`/partners/${selected.id}/enquire`, {
                    command_id: crypto.randomUUID(),
                    message,
                  });
                  toast.success("Enquiry queued");
                  setSelected(null);
                } catch (failure) {
                  setError(failure);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send enquiry
            </button>
            <button
              className={secondaryClass}
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
