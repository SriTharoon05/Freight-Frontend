"use client";
import { useEffect, useState } from "react";
import { usePartnerCommandIds } from "@/lib/partner-command-ids";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import {
  freight,
  dateLabel,
  localDateInput,
  type Job,
  type Page,
} from "@/lib/freight";
import {
  documentTypes,
  operationalRoles,
  managerRoles,
  partnerNetwork,
  taskLabels,
  type NetworkCommand,
  type NetworkEvidence,
  type NetworkList,
  type NetworkTask,
  type Partner,
  type TaskKind,
} from "@/lib/partner-network";
import {
  Panel,
  Field,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "./shared";

function BriefSummary({ brief }: { brief: Record<string, unknown> }) {
  const contacts = ["shipper", "consignee"].map((key) => ({
    key,
    value: brief[key] as {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
    } | null,
  }));
  const cargo = (brief.cargo || []) as {
    description: string;
    pieces: number;
    gross_weight: number;
    weight_unit: string;
    volume: number;
  }[];
  const docs = (brief.documents || []) as { id: string; label: string }[];
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(brief)
          .filter(([, value]) => typeof value === "string" && value)
          .map(([key, value]) => (
            <div key={key}>
              <p className="text-xs text-[#858693]">
                {key.replaceAll("_", " ")}
              </p>
              <p className="whitespace-pre-line">{String(value)}</p>
            </div>
          ))}
      </div>
      {contacts.map(
        ({ key, value }) =>
          value && (
            <div key={key}>
              <strong>
                {key === "shipper" ? "Shipper contact" : "Consignee contact"}
              </strong>
              <p>
                {value.name} · {value.phone} · {value.email}
              </p>
              <p>{value.address}</p>
            </div>
          ),
      )}
      {cargo.map((item, index) => (
        <p key={index}>
          {item.description} · {item.pieces} pieces · {item.gross_weight}{" "}
          {item.weight_unit} · {item.volume} m³
        </p>
      ))}
      <p>
        Shared documents: {docs.map((doc) => doc.label).join(", ") || "None"}
      </p>
    </div>
  );
}

export function DispatchStatus({
  commands,
  jobId,
}: {
  commands: NetworkCommand[];
  jobId: string;
}) {
  const [error, setError] = useState<unknown>(null),
    [notes, setNotes] = useState<Record<string, string>>({});
  const user = useAuthStore((state) => state.user),
    client = useQueryClient();
  return (
    <>
      <ErrorBanner error={error} />
      {commands.map((command) => (
        <div
          key={command.id}
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"
        >
          <strong>
            {command.kind.replaceAll(".", " ")} ·{" "}
            {command.status === "queued" ? "Awaiting dispatch" : command.status}
          </strong>
          {command.last_error && <p className="mt-1">{command.last_error}</p>}
          {["failed"].includes(command.status) &&
            operationalRoles.includes(user?.role || "") && (
              <button
                className={`${secondaryClass} mt-2`}
                onClick={async () => {
                  try {
                    await freight.post(
                      `/partner-commands/${command.id}/retry`,
                      { job_id: jobId },
                    );
                    await client.invalidateQueries({
                      queryKey: ["partner-network", user?.tenant_id],
                    });
                  } catch (failure) {
                    setError(failure);
                  }
                }}
              >
                Retry dispatch
              </button>
            )}
          {command.kind === "email.send" &&
            ["unknown", "sending"].includes(
              String(
                (
                  command as NetworkCommand & {
                    result?: { email_status?: string };
                  }
                ).result?.email_status,
              ),
            ) &&
            managerRoles.includes(user?.role || "") && (
              <div className="mt-2 space-y-2">
                <p>
                  Check the original message in Sent Items before resolving its
                  outcome.
                </p>
                <input
                  aria-label="Email outcome review note"
                  className={inputClass}
                  placeholder="Record what you checked"
                  value={notes[command.id] || ""}
                  onChange={(event) =>
                    setNotes({ ...notes, [command.id]: event.target.value })
                  }
                />
                <div className="flex gap-2">
                  {[
                    ["accepted", "Confirmed sent"],
                    ["not_sent", "Retry confirmed unsent draft"],
                  ].map(([outcome, label]) => (
                    <button
                      key={outcome}
                      className={secondaryClass}
                      disabled={(notes[command.id] || "").trim().length < 5}
                      onClick={async () => {
                        try {
                          await freight.post(
                            `/partner-commands/${command.id}/resolve-email`,
                            { outcome, note: notes[command.id] },
                          );
                          await client.invalidateQueries({
                            queryKey: ["partner-network", user?.tenant_id],
                          });
                        } catch (failure) {
                          setError(failure);
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      ))}
    </>
  );
}

function EvidenceCard({
  jobId,
  taskId,
  evidence,
}: {
  jobId: string;
  taskId: string;
  evidence: NetworkEvidence;
}) {
  const user = useAuthStore((state) => state.user);
  const result = useQuery<{ url: string }>({
    queryKey: [
      "partner-network",
      user?.tenant_id,
      user?.id,
      "evidence",
      evidence.id,
    ],
    queryFn: () =>
      freight.get<{ url: string }>(
        `/jobs/${jobId}/assignments/${taskId}/evidence/${evidence.id}/url`,
      ),
    enabled: evidence.status === "ready",
    staleTime: 240_000,
    refetchInterval: 240_000,
  });
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs font-semibold">
        {(evidence.stage || evidence.kind).replaceAll("_", " ")} · {dateLabel(evidence.captured_at)}
      </p>
      {evidence.location && <p className="mt-1 text-xs text-[#777884]">Near {evidence.location.area?.name || "the recorded location"} · GPS accuracy ±{Math.round(evidence.location.accuracy)} m · Server received {dateLabel(evidence.received_at || "")}{evidence.recipient ? ` · Received by ${evidence.recipient}` : ""}</p>}
      {result.data && (
        <a
          href={result.data.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-xs text-[#7068cf] underline"
        >
          {evidence.content_type.startsWith("image/") && (
            <img
              alt="Submitted task proof"
              src={result.data.url}
              className="mb-2 h-40 w-full rounded-lg object-contain"
            />
          )}
          Open {evidence.filename}
        </a>
      )}
      <ErrorBanner error={result.error} />
    </div>
  );
}

export function PartnerAssignments({ job }: { job: Job }) {
  const user = useAuthStore((state) => state.user),
    client = useQueryClient();
  const [kind, setKind] = useState<TaskKind>("pickup"),
    [partnerId, setPartnerId] = useState("");
  const [scheduled, setScheduled] = useState(localDateInput(job.etd)),
    [instructions, setInstructions] = useState("");
  const [collectionAddress, setCollectionAddress] = useState(
      job.form?.collection_address || "",
    ),
    [deliveryAddress, setDeliveryAddress] = useState(
      job.form?.delivery_address || "",
    );
  const [port, setPort] = useState(""),
    [jurisdiction, setJurisdiction] = useState(""),
    [signature, setSignature] = useState(false);
  const [vehicle, setVehicle] = useState(""),
    [pins, setPins] = useState({ collection: "", delivery: "" });
  const [documentIds, setDocumentIds] = useState<string[]>([]),
    [preview, setPreview] = useState<{
      job_version: number;
      briefing: Record<string, unknown>;
    } | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const key = ["partner-network", user?.tenant_id, user?.id, "tasks", job.id];
  const commandIds = usePartnerCommandIds();
  const tasks = useQuery<NetworkList<NetworkTask>>({
    queryKey: key,
    queryFn: () => partnerNetwork.tasks(job.id),
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const partners = useQuery<Partner[]>({
    queryKey: ["partner-network", user?.tenant_id, user?.id, "agents"],
    queryFn: () => partnerNetwork.partners(),
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const documents = useQuery<
    Page<{ id: string; document_type: string; document_number?: string }>
  >({
    queryKey: [
      "partner-network",
      user?.tenant_id,
      user?.id,
      "job-documents",
      job.id,
    ],
    queryFn: () =>
      freight.get<
        Page<{ id: string; document_type: string; document_number?: string }>
      >(`/jobs/${job.id}/documents`),
    enabled: !!user,
  });
  const detail = useQuery<NetworkTask>({
    queryKey: [...key, selectedTask],
    queryFn: () => partnerNetwork.task(job.id, selectedTask!),
    enabled: !!selectedTask,
    refetchInterval: 15_000,
  });
  const tasksData: NetworkList<NetworkTask> | undefined = tasks.data;
  const partnersData: Partner[] | undefined = partners.data;
  const documentsData:
    | Page<{ id: string; document_type: string; document_number?: string }>
    | undefined = documents.data;
  const detailData: NetworkTask | undefined = detail.data;
  const canOperate = operationalRoles.includes(user?.role || "");
  const capability = kind.startsWith("customs") ? "customs" : "pickup_delivery";
  const candidates = (partnersData || []).filter(
    (partner) =>
      partner.capabilities.includes(capability) &&
      partner.relationship?.status === "approved",
  );
  useEffect(() => {
    setPreview(null);
  }, [
    kind,
    partnerId,
    scheduled,
    instructions,
    collectionAddress,
    deliveryAddress,
    vehicle,
    pins,
    documentIds,
    job.version,
    port,
    jurisdiction,
    signature,
  ]);
  const refresh = () =>
    client.invalidateQueries({
      queryKey: ["partner-network", user?.tenant_id],
    });
  function briefBody() {
    const pin = (value: string) =>
      value.trim() ? value.split(",").map(Number) : null;
    for (const value of [pins.collection, pins.delivery]) {
      if (
        value &&
        (value.split(",").length !== 2 ||
          value
            .split(",")
            .some(
              (coordinate) =>
                !coordinate.trim() || !Number.isFinite(Number(coordinate)),
            ))
      )
        throw new Error("Enter map pins as latitude, longitude");
    }
    return {
      kind,
      document_ids: documentIds,
      collection_address: collectionAddress,
      delivery_address: deliveryAddress,
      port: port || null,
      jurisdiction: jurisdiction || null,
      vehicle_requirements: vehicle,
      collection_pin: pin(pins.collection),
      delivery_pin: pin(pins.delivery),
    };
  }
  async function staffAction(action: string) {
    if (!detailData) return;
    setBusy(true);
    setError(null);
    try {
      await freight.post(
        `/jobs/${job.id}/assignments/${detailData.id}/${action}`,
        {
          command_id: commandIds({
            job: job.id,
            task: detailData.id,
            action,
            version: detailData.version,
            reason,
            replacement,
          }).command_id,
          version: detailData.version,
          reason,
          new_partner_id: action === "reassign" ? replacement : null,
        },
      );
      toast.success("Task update queued");
      await refresh();
      setReason("");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <ErrorBanner
        error={error || tasks.error || partners.error || detail.error}
      />
      {tasksData && !tasksData.network_available && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs">
          Showing the last synchronized updates. The partner network is
          temporarily unavailable.
        </p>
      )}
      <DispatchStatus commands={tasksData?.commands || []} jobId={job.id} />
      <Panel
        title="Assigned partner tasks"
        action={
          <button className={secondaryClass} onClick={() => tasks.refetch()}>
            Refresh
          </button>
        }
      >
        {tasks.isLoading && <p className="text-sm">Loading assignments…</p>}
        {tasksData?.items.length === 0 && (
          <p className="text-sm text-[#777884]">
            No partner tasks assigned to this job.
          </p>
        )}
        <div className="space-y-3">
          {tasksData?.items.map((task) => (
            <article
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <p className="text-sm font-semibold">
                  {taskLabels[task.kind]} ·{" "}
                  {partnersData?.find(
                    (partner) => partner.id === task.partner_id,
                  )?.name || "Assigned partner"}
                </p>
                <p className="mt-1 text-xs text-[#777884]">
                  {dateLabel(task.scheduled_at)} ·{" "}
                  {task.status.replaceAll("_", " ")}
                </p>
              </div>
              <button
                className={secondaryClass}
                onClick={() => {
                  setSelectedTask(task.id);
                  setReason("");
                }}
              >
                View task and proof
              </button>
            </article>
          ))}
        </div>
      </Panel>
      {detailData && (
        <Panel
          title={`${taskLabels[detailData.kind]} details`}
          action={
            <button
              className={secondaryClass}
              onClick={() => setSelectedTask(null)}
            >
              Close
            </button>
          }
        >
          <p className="text-sm">
            {detailData.instructions || "No additional instructions"}
          </p>
          <p className="mt-2 text-xs text-[#777884]">
            Brief {detailData.brief_version} ·{" "}
            {detailData.acknowledged_brief_version === detailData.brief_version
              ? "Acknowledged"
              : "Awaiting acknowledgement"}{" "}
            · GPS: {detailData.tracking_status}
          </p>
          {detailData.driver && <p className="mt-2 text-xs">Driver: {detailData.driver.name} · {detailData.driver.phone}{detailData.driver.vehicle ? ` · ${detailData.driver.vehicle}` : ""} · Link expires {dateLabel(detailData.driver.expires_at)}</p>}
          {detailData.last_location && (
            <div className="mt-4 rounded-xl border p-3">
              <p className="text-xs font-semibold">
                {detailData.location_stale ||
                Date.now() -
                  new Date(detailData.last_location.captured_at).getTime() >
                  120000
                  ? "Last known location · delayed"
                  : "Current location"}
              </p>
              <p className="mt-1 text-xs">
                Captured {dateLabel(detailData.last_location.captured_at)} ·
                accuracy {Number(detailData.last_location.accuracy).toFixed(0)}{" "}
                m
              </p>
              {detailData.last_location.area?.name && <p className="mt-1 text-sm font-semibold">Near {detailData.last_location.area.name}</p>}
              <iframe
                title="Driver location map"
                className="mt-3 h-60 w-full rounded-lg"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(detailData.last_location.longitude) - 0.01},${Number(detailData.last_location.latitude) - 0.01},${Number(detailData.last_location.longitude) + 0.01},${Number(detailData.last_location.latitude) + 0.01}&layer=mapnik&marker=${detailData.last_location.latitude},${detailData.last_location.longitude}`}
              />
              <a className="mt-2 inline-block text-xs text-[#7068cf] underline" href={`https://www.google.com/maps?q=${detailData.last_location.latitude},${detailData.last_location.longitude}`} target="_blank" rel="noopener noreferrer">Open driver location in Google Maps ↗</a>
            </div>
          )}
          <p className="mt-4 text-xs">
            Recipient: {detailData.completion.recipient || "—"} · Clearance
            reference: {detailData.completion.clearance_reference || "—"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {detailData.evidence?.map((item) => (
              <EvidenceCard
                key={item.id}
                jobId={job.id}
                taskId={detailData!.id}
                evidence={item}
              />
            ))}
          </div>
          <div className="mt-4 space-y-1">
            {detailData.events?.map((event) => (
              <p key={event.id} className="text-xs text-[#777884]">
                {event.kind.replaceAll("_", " ")}
                {typeof event.payload.milestone === "string" &&
                  ` · ${event.payload.milestone.replaceAll("_", " ")}`}
                {typeof event.payload.reason === "string" &&
                  event.payload.reason &&
                  ` · ${event.payload.reason}`}
                {" · Occurred at: "}{dateLabel(event.occurred_at || event.captured_at)}
                {" · Recorded at: "}{dateLabel(event.created_at)}
              </p>
            ))}
          </div>
          {canOperate &&
            !["completed", "cancelled", "rejected"].includes(
              detailData.status,
            ) && (
              <div className="mt-5 space-y-3">
                <Field label="Review, cancellation or reassignment reason">
                  <textarea
                    className={inputClass}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {detailData.status === "awaiting_verification" && (
                    <>
                      <button
                        className={buttonClass}
                        disabled={
                          busy ||
                          !detailData.evidence?.some(
                            (item) => item.status === "ready",
                          )
                        }
                        onClick={() => staffAction("verify")}
                      >
                        Verify completion
                      </button>
                      <button
                        className={secondaryClass}
                        disabled={busy || !reason.trim()}
                        onClick={() => staffAction("return")}
                      >
                        Return for correction
                      </button>
                    </>
                  )}
                  <button
                    className={secondaryClass}
                    disabled={busy || !reason.trim()}
                    onClick={() => staffAction("cancel")}
                  >
                    Cancel task
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    className={inputClass}
                    aria-label="Replacement partner"
                    value={replacement}
                    onChange={(event) => setReplacement(event.target.value)}
                  >
                    <option value="">Select replacement partner</option>
                    {partnersData
                      ?.filter(
                        (partner) =>
                          partner.id !== detailData!.partner_id &&
                          partner.relationship?.status === "approved" &&
                          partner.capabilities.includes(
                            detailData!.kind.startsWith("customs")
                              ? "customs"
                              : "pickup_delivery",
                          ),
                      )
                      .map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className={secondaryClass}
                    disabled={busy || !replacement || !reason.trim()}
                    onClick={() => staffAction("reassign")}
                  >
                    Reassign
                  </button>
                </div>
              </div>
            )}
        </Panel>
      )}
      {canOperate && !["closed", "cancelled"].includes(job.status) && (
        <Panel title="Assign a partner">
          <p className="mb-4 text-xs text-[#777884]">
            Choose an approved partner and review the exact briefing before
            dispatch.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task">
              <select
                className={inputClass}
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as TaskKind);
                  setPartnerId("");
                  setDocumentIds([]);
                }}
              >
                {Object.entries(taskLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Approved partner">
              <select
                className={inputClass}
                value={partnerId}
                onChange={(event) => setPartnerId(event.target.value)}
              >
                <option value="">Choose partner</option>
                {candidates.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scheduled time">
              <input
                type="datetime-local"
                className={inputClass}
                value={scheduled}
                onChange={(event) => setScheduled(event.target.value)}
              />
            </Field>
            {kind.startsWith("customs") && (
              <>
                <Field label="Port">
                  <input
                    className={inputClass}
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                  />
                </Field>
                <Field label="Jurisdiction">
                  <input
                    className={inputClass}
                    value={jurisdiction}
                    onChange={(event) => setJurisdiction(event.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label="Vehicle requirements">
              <input
                className={inputClass}
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
              />
            </Field>
            <Field label="Collection address">
              <textarea
                className={inputClass}
                value={collectionAddress}
                onChange={(event) => setCollectionAddress(event.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Delivery address">
              <textarea
                className={inputClass}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                rows={2}
              />
            </Field>
            <Field label="Collection pin (latitude, longitude)">
              <input
                className={inputClass}
                value={pins.collection}
                onChange={(event) =>
                  setPins({ ...pins, collection: event.target.value })
                }
                placeholder="19.0760, 72.8777"
              />
            </Field>
            <Field label="Delivery pin (latitude, longitude)">
              <input
                className={inputClass}
                value={pins.delivery}
                onChange={(event) =>
                  setPins({ ...pins, delivery: event.target.value })
                }
              />
            </Field>
          </div>
          {!kind.startsWith("customs") && (
            <label className="my-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={signature}
                onChange={(event) => setSignature(event.target.checked)}
              />
              Require signature evidence in addition to photos and recipient
              details
            </label>
          )}
          <Field label="Instructions">
            <textarea
              className={`${inputClass} mt-1`}
              rows={3}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </Field>
          <div className="my-4">
            <p className="mb-2 text-xs font-semibold">Documents to share</p>
            <ErrorBanner error={documents.error} />
            {documentsData?.items
              .filter((doc) => documentTypes[kind].includes(doc.document_type))
              .map((doc) => (
                <label
                  key={doc.id}
                  className="mr-4 inline-flex items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={documentIds.includes(doc.id)}
                    onChange={(event) =>
                      setDocumentIds(
                        event.target.checked
                          ? [...documentIds, doc.id]
                          : documentIds.filter((id) => id !== doc.id),
                      )
                    }
                  />
                  {doc.document_number ||
                    doc.document_type.replaceAll("_", " ")}
                </label>
              ))}
          </div>
          {preview && (
            <div className="my-4 rounded-xl bg-[#f7f6fb] p-4">
              <h3 className="mb-3 text-xs font-semibold">
                Partner briefing · Job version {preview.job_version}
              </h3>
              <BriefSummary brief={preview.briefing} />
              <p className="mt-3 text-xs">
                Required proof:{" "}
                {kind.startsWith("customs")
                  ? "clearance document and reference"
                  : `photo and handover recipient${signature ? " and signature" : ""}`}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              className={secondaryClass}
              disabled={busy || !partnerId || !scheduled}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  setPreview(
                    await freight.post(
                      `/jobs/${job.id}/assignment-preview`,
                      briefBody(),
                    ),
                  );
                } catch (failure) {
                  setError(failure);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Preview briefing
            </button>
            <button
              className={buttonClass}
              disabled={busy || !preview || !partnerId || !scheduled}
              onClick={async () => {
                if (!preview) return;
                setBusy(true);
                setError(null);
                try {
                  const body = {
                    ...briefBody(),
                    partner_id: partnerId,
                    scheduled_at: new Date(scheduled).toISOString(),
                    job_version: preview.job_version,
                    instructions,
                    required_proof:
                      signature && !kind.startsWith("customs")
                        ? ["signature"]
                        : [],
                  };
                  const ids = commandIds({ job: job.id, ...body });
                  await freight.post(`/jobs/${job.id}/assignments`, {
                    ...body,
                    command_id: ids.command_id,
                    task_id: ids.task_id,
                  });
                  commandIds.complete({ job: job.id, ...body });
                  toast.success("Assignment queued for dispatch");
                  setPreview(null);
                  await refresh();
                } catch (failure) {
                  setError(failure);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Dispatch assignment
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
