"use client";
import { useState } from "react";
import { usePartnerCommandIds } from "@/lib/partner-command-ids";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { freight, type Job, dateLabel, moneyLabel } from "@/lib/freight";
import {
  partnerNetwork,
  operationalRoles,
  type SpaceEnquiry,
  type NetworkList,
  type WarehouseListing,
} from "@/lib/partner-network";
import {
  Panel,
  Field,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "./shared";
import { DispatchStatus } from "./partner-assignments";

function HandoverProof({
  jobId,
  reservationId,
  evidenceId,
}: {
  jobId: string;
  reservationId: string;
  evidenceId: string;
}) {
  const user = useAuthStore((state) => state.user);
  const proof = useQuery<{ url: string }>({
    queryKey: [
      "partner-network",
      user?.tenant_id,
      user?.id,
      "warehouse-proof",
      evidenceId,
    ],
    queryFn: () =>
      freight.get<{ url: string }>(
        `/jobs/${jobId}/reservations/${reservationId}/evidence/${evidenceId}/url`,
      ),
    staleTime: 240000,
    refetchInterval: 240000,
  });
  return (
    <>
      <ErrorBanner error={proof.error} />
      {proof.data && (
        <a
          className="mr-3 text-xs text-[#7068cf] underline"
          href={proof.data.url}
          target="_blank"
          rel="noreferrer"
        >
          Open handover proof
        </a>
      )}
    </>
  );
}

export function PartnerWarehouseRequests({ job }: { job: Job }) {
  const user = useAuthStore((s) => s.user),
    client = useQueryClient();
  const key = ["partner-network", user?.tenant_id, user?.id, job.id, "space"];
  const commandIds = usePartnerCommandIds();
  const list = useQuery<NetworkList<SpaceEnquiry>>({
    queryKey: key,
    queryFn: () => partnerNetwork.space(job.id),
    refetchInterval: 15000,
  });
  const [city, setCity] = useState(""),
    [facility, setFacility] = useState("");
  const warehouses = useQuery<WarehouseListing[]>({
    queryKey: [
      "partner-network",
      user?.tenant_id,
      "warehouses",
      city,
      facility,
    ],
    queryFn: () => partnerNetwork.warehouses(city, facility),
  });
  const [pools, setPools] = useState<string[]>([]),
    [unit, setUnit] = useState("pallet"),
    [quantity, setQuantity] = useState("1");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [handling, setHandling] = useState(""),
    [storage, setStorage] = useState("");
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const spaceData: NetworkList<SpaceEnquiry> | undefined = list.data;
  const warehousesData: WarehouseListing[] | undefined = warehouses.data;
  const canWrite = operationalRoles.includes(user?.role || "");
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success("Request queued for dispatch");
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function act(enquiry: SpaceEnquiry, action: string, extra = {}) {
    return run(() =>
      freight.post(`/jobs/${job.id}/space-requests/${enquiry.id}/${action}`, {
        command_id: commandIds({
          job: job.id,
          enquiry: enquiry.id,
          version: enquiry.version,
          action,
          ...extra,
        }).command_id,
        version: enquiry.version,
        ...extra,
      }),
    );
  }
  return (
    <div className="space-y-5">
      <ErrorBanner error={error || list.error} />
      {spaceData && !spaceData.network_available && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm">
          Showing the last synchronized requests. Booking actions require a
          connection.
        </p>
      )}
      <DispatchStatus commands={spaceData?.commands || []} jobId={job.id} />
      <Panel title="Warehouse space requests">
        {!spaceData?.items.length && (
          <p className="text-sm text-[#858693]">
            No warehouse requests for this job yet.
          </p>
        )}
        <div className="space-y-6">
          {spaceData?.items.map((enquiry) => (
            <article
              key={enquiry.id}
              className="rounded-xl border p-4 space-y-3"
            >
              <p className="font-semibold">
                {enquiry.quantity} {enquiry.unit} ·{" "}
                {enquiry.status.replaceAll("_", " ")}
              </p>
              <p className="text-xs">
                {dateLabel(enquiry.starts_at)} → {dateLabel(enquiry.ends_at)}
              </p>
              {enquiry.requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg bg-[#f8f7fc] p-3 space-y-2"
                >
                  <p className="font-semibold text-sm">
                    {request.warehouse_name} · {request.pool_name}
                  </p>
                  <p className="text-xs">
                    {request.status.replaceAll("_", " ")} · Email:{" "}
                    {request.email_delivery?.status.replaceAll("_", " ") ||
                      "queued"}
                  </p>
                  <p className="text-xs">
                    App:{" "}
                    {request.app_read_at
                      ? `Read ${dateLabel(request.app_read_at)}`
                      : "Unread"}{" "}
                    · Push:{" "}
                    {request.push_delivery?.status.replaceAll("_", " ") ||
                      "queued"}
                  </p>
                  {request.email_delivery?.last_error && (
                    <p className="text-xs text-red-700">
                      {request.email_delivery.last_error}
                    </p>
                  )}
                  {request.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-lg border bg-white p-3 text-sm space-y-2"
                    >
                      <p>
                        {offer.quantity} {enquiry.unit} · Storage{" "}
                        {moneyLabel(offer.base_price, offer.currency)} ·
                        Handling{" "}
                        {moneyLabel(offer.handling_charge, offer.currency)} ·
                        Tax {moneyLabel(offer.tax_amount, offer.currency)}
                      </p>
                      <p className="font-semibold">
                        Total{" "}
                        {moneyLabel(
                          Number(offer.base_price) +
                            Number(offer.handling_charge) +
                            Number(offer.tax_amount),
                          offer.currency,
                        )}
                      </p>
                      <p className="whitespace-pre-line">{offer.terms}</p>
                      <p className="text-xs">
                        Valid until {dateLabel(offer.valid_until)}
                      </p>
                      {canWrite && enquiry.status === "open" && (
                        <button
                          disabled={
                            busy || new Date(offer.valid_until) <= new Date()
                          }
                          className={buttonClass}
                          onClick={() =>
                            act(enquiry, "select", { offer_id: offer.id })
                          }
                        >
                          Select offer
                        </button>
                      )}
                      {enquiry.selected_offer_id === offer.id && (
                        <p className="text-[#7068cf]">
                          {enquiry.reservations.some((reservation) => reservation.status !== "cancelled")
                            ? "Selected · reservation confirmed"
                            : "Selected · awaiting owner confirmation"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {enquiry.reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="font-semibold">
                    Reservation: {reservation.status}
                  </p>
                  {reservation.handovers.map((handover, i) => (
                    <div key={i}>
                      <p>
                        {handover.action} · {handover.recipient} ·{" "}
                        {dateLabel(handover.captured_at)}
                      </p>
                      {(handover.evidence_ids || []).map((id) => (
                        <HandoverProof
                          key={id}
                          jobId={job.id}
                          reservationId={reservation.id}
                          evidenceId={id}
                        />
                      ))}
                    </div>
                  ))}
                  {canWrite && reservation.status === "confirmed" && (
                    <button
                      disabled={busy}
                      className={secondaryClass}
                      onClick={() =>
                        act(enquiry, "cancel-reservation", {
                          reservation_id: reservation.id,
                          reason: "Cancelled by staff",
                        })
                      }
                    >
                      Cancel reservation
                    </button>
                  )}
                </div>
              ))}
              {canWrite &&
                ["open", "pending_confirmation"].includes(enquiry.status) && (
                  <button
                    disabled={busy}
                    className={secondaryClass}
                    onClick={() =>
                      act(enquiry, "cancel", { reason: "Cancelled by staff" })
                    }
                  >
                    Cancel enquiry
                  </button>
                )}
            </article>
          ))}
        </div>
      </Panel>
      {canWrite && (
        <Panel title="Request warehouse space">
          <p className="mb-4 text-sm text-[#858693]">
            Each selected owner receives a private app request and email. A
            quotation does not reserve capacity. Approve the owner in Partners
            before selecting their offer.
          </p>
          <ErrorBanner error={warehouses.error} />
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const body = {
                  pool_ids: pools,
                  unit,
                  quantity: Number(quantity),
                  starts_at: new Date(start).toISOString(),
                  ends_at: new Date(end).toISOString(),
                  handling,
                  storage,
                };
                const ids = commandIds({ job: job.id, ...body });
                await freight.post(`/jobs/${job.id}/space-requests`, {
                  ...body,
                  command_id: ids.command_id,
                  enquiry_id: ids.enquiry_id,
                });
                commandIds.complete({ job: job.id, ...body });
                setPools([]);
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="City">
                <input
                  className={inputClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
              <Field label="Facility">
                <input
                  className={inputClass}
                  value={facility}
                  placeholder="e.g. refrigerated"
                  onChange={(e) => setFacility(e.target.value)}
                />
              </Field>
              <Field label="Space unit">
                <select
                  className={inputClass}
                  value={unit}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    setPools([]);
                  }}
                >
                  <option value="pallet">Pallet positions</option>
                  <option value="sqft">Square feet</option>
                  <option value="cbm">Cubic metres</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {warehousesData?.map((w) => (
                <div key={w.id} className="rounded-xl border p-3 text-sm">
                  <strong>{w.name}</strong>
                  <p>
                    {w.address}, {w.city}
                  </p>
                  <p className="text-xs">{w.facilities.join(" · ")}</p>
                  {w.pools
                    .filter((p) => p.unit === unit)
                    .map((p) => (
                      <label key={p.id} className="mt-2 flex gap-2">
                        <input
                          type="checkbox"
                          checked={pools.includes(p.id)}
                          onChange={(e) =>
                            setPools(
                              e.target.checked
                                ? [...pools, p.id]
                                : pools.filter((id) => id !== p.id),
                            )
                          }
                        />
                        {p.name} · capacity {p.capacity} {p.unit}
                      </label>
                    ))}
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Quantity">
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  className={inputClass}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="From">
                <input
                  required
                  type="datetime-local"
                  className={inputClass}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Until">
                <input
                  required
                  type="datetime-local"
                  min={start}
                  className={inputClass}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Handling requirements">
              <textarea
                className={inputClass}
                value={handling}
                onChange={(e) => setHandling(e.target.value)}
              />
            </Field>
            <Field label="Storage requirements">
              <textarea
                className={inputClass}
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
              />
            </Field>
            <button disabled={busy || !pools.length} className={buttonClass}>
              Send requests to {pools.length} capacity pools
            </button>
          </form>
        </Panel>
      )}
    </div>
  );
}
