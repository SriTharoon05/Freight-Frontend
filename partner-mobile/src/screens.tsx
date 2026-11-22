import React, { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { alerts as Alert } from "./alerts";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { api, signInWithGoogle } from "./auth";
import {
  cache,
  remember,
  pending,
  enqueue,
  localTask,
  saveProof,
  discardResource,
} from "./store";
import { online, synchronize } from "./sync";
import { permission, stopTracking } from "./tracking";
import { optimistic } from "./domain";
import { label, terminal, type Json, type Task } from "./types";
import { Button, Card, Choice, Field, Heading, Info, styles } from "./ui";
import { TripMap } from "./TripMap";

export function SignIn() {
  return (
    <Card>
      <Heading>Sign in to Freight Partners</Heading>
      <Info>Use one Google account for all your freight companies. Your phone number is a contact detail.</Info>
      <Button onPress={signInWithGoogle}>Continue with Google</Button>
    </Card>
  );
}

export function Profile({
  profile,
  reload,
  logout,
}: {
  profile: Json | null;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [name, setName] = useState(profile?.name || ""),
    [capabilities, setCapabilities] = useState<string[]>(
      profile?.capabilities || ["pickup_delivery"],
    );
  const [coverage, setCoverage] = useState<string>(
      (profile?.coverage || []).join(", "),
    ),
    [ports, setPorts] = useState<string>((profile?.ports || []).join(", ")),
    [credentials, setCredentials] = useState<string>(
      (profile?.credentials || []).join(", "),
    );
  const [discoverable, setDiscoverable] = useState(
      profile?.discoverable || false,
    ),
    [contactPhone, setContactPhone] = useState(profile?.phone || "");
  const [relationships, setRelationships] = useState<Json[]>([]);
  useEffect(() => {
    if (profile)
      void api<Json[]>("/relationships")
        .then(setRelationships)
        .catch(() => {});
  }, [profile]);
  return (
    <>
      <Card>
        <Heading>{profile ? "Your profile" : "Register as a partner"}</Heading>
        <Info>
          Verification: {profile?.verification || "registration required"}
        </Info>
        <Field label="Full name" value={name} set={setName} />
        <Field label="Contact phone with country code (optional)" value={contactPhone} set={setContactPhone} keyboardType="phone-pad" />
        <View style={styles.row}>
          {[
            ["pickup_delivery", "Pickup / delivery"],
            ["customs", "Customs clearance"],
            ["warehouse_owner", "Warehouse owner"],
          ].map(([id, text]) => (
            <Choice
              key={id}
              selected={capabilities.includes(id)}
              onPress={() =>
                setCapabilities(
                  capabilities.includes(id)
                    ? capabilities.filter((c) => c !== id)
                    : [...capabilities, id],
                )
              }
            >
              {text}
            </Choice>
          ))}
        </View>
        <Field
          label="Coverage areas, separated by commas"
          value={coverage}
          set={setCoverage}
        />
        <Field
          label="Ports served, separated by commas"
          value={ports}
          set={setPorts}
        />
        <Field
          label="Business credentials / licence references"
          value={credentials}
          set={setCredentials}
          multiline
        />
        <Choice
          selected={discoverable}
          onPress={() => setDiscoverable(!discoverable)}
        >
          Appear in the verified partner directory
        </Choice>
        <Button
          onPress={async () => {
            await api("/profile", "PUT", {
              name,
              phone: contactPhone.trim(),
              capabilities,
              coverage: coverage
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              ports: ports
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              credentials: credentials
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              discoverable,
            });
            await reload();
          }}
        >
          Save profile
        </Button>
      </Card>
      <Card>
        <Heading>Google account</Heading>
        <Info>
          {profile?.email || "Your verified Google email will be saved with your profile."}
        </Info>
        <Info>Google verifies your sign-in email. Business verification and company approval are managed separately.</Info>
      </Card>
      {relationships.map((link) => (
        <Card key={link.id}>
          <Heading>{link.company_name}</Heading>
          <Info>Relationship: {label(link.status)}</Info>
          <Button
            secondary
            onPress={async () => {
              await api(`/relationships/${link.id}/decline`, "POST", {
                id: link.id,
                reason: "Declined by partner",
              });
              await reload();
            }}
          >
            Decline relationship
          </Button>
        </Card>
      ))}
      <Button secondary onPress={logout}>
        Sign out
      </Button>
    </>
  );
}

async function proof(
  resource: string,
  kind: string,
  camera: boolean,
  reservation = false,
) {
  if (camera) {
    if (!(await ImagePicker.requestCameraPermissionsAsync()).granted)
      throw new Error(
        "Camera permission is needed. You can also choose an existing file.",
      );
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled)
      return saveProof(
        resource,
        result.assets[0].uri,
        kind,
        "image/jpeg",
        reservation,
      );
  } else {
    const result = await DocumentPicker.getDocumentAsync({
      type:
        kind === "photo" || kind === "signature"
          ? ["image/jpeg", "image/png"]
          : ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      return saveProof(
        resource,
        result.assets[0].uri,
        kind,
        result.assets[0].mimeType || "application/pdf",
        reservation,
      );
  }
}

export function TaskList({
  tasks,
  select,
}: {
  tasks: Task[];
  select: (task: Task) => void;
}) {
  return (
    <>
      {!tasks.length && (
        <Card>
          <Info>Your assigned work will appear here.</Info>
        </Card>
      )}
      {tasks.map((task) => (
        <Card key={task.id}>
          <Text style={styles.muted}>{task.company_name}</Text>
          <Heading>
            {label(task.kind)} · {task.job_reference}
          </Heading>
          <Info>
            {label(task.status)}
            {task.pending_sync ? " · Pending sync" : ""}
          </Info>
          <Text style={styles.muted}>
            {new Date(task.scheduled_at).toLocaleString()}
          </Text>
          <Button secondary onPress={() => select(task)}>
            View task
          </Button>
        </Card>
      ))}
    </>
  );
}

export function TaskDetail({
  initial,
  changed,
  back,
}: {
  initial: Task;
  changed: () => Promise<void>;
  back: () => void;
}) {
  const [task, setTask] = useState(initial),
    [recipient, setRecipient] = useState(""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [proofKind, setProofKind] = useState(
      initial.kind.startsWith("customs") ? "clearance_document" : "photo",
    );
  const [proofs, setProofs] = useState<Json[]>([]),
    [error, setError] = useState("");
  const [driverName, setDriverName] = useState(initial.driver?.name || "");
  const [driverPhone, setDriverPhone] = useState(initial.driver?.phone || "");
  const [driverEmail, setDriverEmail] = useState(initial.driver?.email || "");
  const [vehicle, setVehicle] = useState(initial.driver?.vehicle || "");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [driverLink, setDriverLink] = useState<Json | null>(null);
  const [actualTime, setActualTime] = useState("");
  const driverRequest = useRef<{ key: string; id: string } | null>(null);
  async function load() {
    const local = await localTask(initial.id);
    if (local) setTask(local);
    try {
      await synchronize();
      const queued = await pending();
      const remote = await api<Task>(`/tasks/${initial.id}`);
      if (
        !queued.some((q) => q.resource_id === initial.id && q.kind === "action")
      ) {
        setTask(remote);
        setDriverLink((current) => current && current.id !== remote.driver?.id ? null : current);
        await remember("task:" + remote.id, remote);
      }
      const uploads = queued
        .filter((q) => q.resource_id === initial.id && q.kind === "upload")
        .map((q) => ({ ...q.payload.metadata, status: "pending_sync" }));
      setProofs([...(remote.evidence || []), ...uploads]);
      setError(
        queued.find((q) => q.resource_id === initial.id && q.error)?.error ||
          "",
      );
    } catch {
      const queued = await pending();
      setProofs([
        ...(local?.evidence || []),
        ...queued
          .filter((q) => q.resource_id === initial.id && q.kind === "upload")
          .map((q) => ({ ...q.payload.metadata, status: "pending_sync" })),
      ]);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [initial.id]);
  const transport = ["pickup", "delivery"].includes(task.kind),
    briefing = task.briefing || {};
  async function action(name: string, extra: Json = {}) {
    if (name === "submit-completion") {
      if (transport && !recipient.trim())
        throw new Error("Record the handover recipient before submitting.");
      if (!transport && !reference.trim())
        throw new Error(
          "Record the customs clearance reference before submitting.",
        );
      const kinds = new Set(proofs.map((p) => p.kind));
      for (const kind of task.required_proof.filter((k) => k !== "recipient"))
        if (!kinds.has(kind))
          throw new Error(
            `Add the required ${label(kind).toLowerCase()} before submitting.`,
          );
    }
    const occurred = actualTime ? new Date(actualTime) : new Date();
    if (!Number.isFinite(occurred.getTime()) || occurred.getTime() > Date.now() + 300000)
      throw new Error("Enter a valid actual time including its timezone, such as 2026-10-19T14:30+05:30.");
    const body = {
      event_id: Crypto.randomUUID(),
      version: task.version,
      brief_version: task.brief_version,
      captured_at: new Date().toISOString(),
      occurred_at: occurred.toISOString(),
      ...extra,
    };
    if (["accept", "decline", "acknowledge"].includes(name)) {
      if (!(await online()))
        throw new Error("Connect to the internet to confirm this action.");
      const saved = await api<Task>(
        `/tasks/${task.id}/actions/${name}`,
        "POST",
        body,
      );
      setTask({ ...task, ...saved });
      await remember("task:" + task.id, { ...task, ...saved });
    } else {
      await enqueue(task.id, "action", { action: name, body }, body.event_id);
      const next = optimistic(task, name);
      setTask(next);
      await remember("task:" + task.id, next);
      if (name === "submit-completion") await stopTracking(task.id);
      await synchronize();
    }
    await load();
    setActualTime("");
    await changed();
  }
  return (
    <>
      <Button secondary onPress={back}>
        ← All tasks
      </Button>
      <Card>
        <Text style={styles.muted}>{task.company_name}</Text>
        <Heading>
          {label(task.kind)} · {task.job_reference}
        </Heading>
        <Info>
          {label(task.status)}
          {task.pending_sync ? " · Pending sync" : ""}
        </Info>
        <Info>{new Date(task.scheduled_at).toLocaleString()}</Info>
        {task.acknowledged_brief_version < task.brief_version && (
          <>
            <Text style={styles.error}>
              The briefing changed. Review it before continuing.
            </Text>
            <Button onPress={() => action("acknowledge")}>
              Acknowledge revised instructions
            </Button>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {!terminal(task.status) && (
          <>
            <Info>
              {briefing.origin} → {briefing.destination}
            </Info>
            {[
              "collection_address",
              "delivery_address",
              "handling",
              "vehicle_requirements",
              "port",
              "jurisdiction",
              "master_number",
              "house_number",
            ].map((key) =>
              briefing[key] ? (
                <Info key={key}>
                  {label(key)}: {briefing[key]}
                </Info>
              ) : null,
            )}
            {[
              ["collection_pin", "Collection map"],
              ["delivery_pin", "Delivery map"],
            ].map(
              ([key, title]) =>
                briefing[key] && (
                  <Button
                    key={key}
                    secondary
                    onPress={() =>
                      Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${briefing[key][0]},${briefing[key][1]}`,
                      )
                    }
                  >
                    {title}
                  </Button>
                ),
            )}
            {["shipper", "consignee"].map(
              (key) =>
                briefing[key] && (
                  <View key={key}>
                    <Heading>{label(key)}</Heading>
                    <Info>{briefing[key].name}</Info>
                    <Info>{briefing[key].address}</Info>
                    {briefing[key].phone && (
                      <Button
                        secondary
                        onPress={() =>
                          Linking.openURL("tel:" + briefing[key].phone)
                        }
                      >
                        {briefing[key].phone}
                      </Button>
                    )}
                  </View>
                ),
            )}
            {briefing.cargo?.map((item: Json, i: number) => (
              <Info key={i}>
                {item.description} · {item.pieces} pieces · {item.gross_weight}{" "}
                {item.weight_unit} · {item.volume} m³
              </Info>
            ))}
            <Info>{task.instructions}</Info>
            <Info>
              Required proof: {task.required_proof.map(label).join(", ")}
            </Info>
            {briefing.documents?.map((doc: Json) => (
              <Button
                secondary
                key={doc.id}
                onPress={async () => {
                  const response = await api(
                    `/tasks/${task.id}/documents/${doc.id}/url`,
                  );
                  await Linking.openURL(response.url);
                }}
              >
                {doc.label}
              </Button>
            ))}
          </>
        )}
      </Card>
      {task.status === "pending_accept" && (
        <Card>
          <Button onPress={() => action("accept")}>Accept assignment</Button>
          <Field label="Reason for declining" value={reason} set={setReason} />
          <Button secondary onPress={() => action("decline", { reason })}>
            Decline assignment
          </Button>
        </Card>
      )}
      {transport && ["accepted", "in_progress", "awaiting_verification"].includes(task.status) && (
        <Card variant="driver">
          <Heading>Driver assignment</Heading>
          <Info>You manage this transport task. The driver records progress, proofs and location in their browser.</Info>
          {task.driver && <Info>{task.driver.name} · {task.driver.email} · {task.driver.phone}{task.driver.vehicle ? ` · ${task.driver.vehicle}` : ""}</Info>}
          {task.driver && (
            <>
              <Info>GPS: {label(task.tracking_status)}. Browser updates can pause when the phone locks or the page closes.</Info>
              {task.last_location && <Info>Last driver location: {new Date(task.last_location.captured_at).toLocaleString()} · {task.location_stale ? "Delayed" : "Recent"}</Info>}
              <TripMap point={task.last_location} tileURL={task.map?.tile_url} />
              <Button secondary onPress={async () => {
                const link = await api(`/tasks/${task.id}/driver-link`);
                setDriverLink(link);
                await Linking.openURL(link.whatsapp_url);
              }}>Share driver link on WhatsApp</Button>
              <Button secondary onPress={async () => {
                const link = await api(`/tasks/${task.id}/driver-link`);
                setDriverLink(link);
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(link.url);
                } else {
                  await Linking.openURL(link.url);
                }
              }}>Copy / retrieve driver link</Button>
            </>
          )}
          {task.status !== "awaiting_verification" && (
            <>
              <Field label="Driver name" value={driverName} set={setDriverName} />
              <Field label="Driver Google account email" value={driverEmail} set={setDriverEmail} keyboardType="email-address" />
              <Field label="Driver phone with country code" value={driverPhone} set={setDriverPhone} keyboardType="phone-pad" />
              <Field label="Vehicle registration (optional)" value={vehicle} set={setVehicle} />
              <Choice selected={whatsappConsent} onPress={() => setWhatsappConsent(!whatsappConsent)}>Driver agreed to receive this task on WhatsApp</Choice>
              <Info>The driver signs in with this Google email to open the assignment. Phone is used for contact and WhatsApp sharing. Assigning again revokes the previous link.</Info>
              <Button onPress={async () => {
                if (!(await online())) throw new Error("Connect to the internet to assign a driver.");
                const name = driverName.trim(), phone = driverPhone.trim(), email = driverEmail.trim().toLowerCase();
                if (name.length < 2 || !/^\+[1-9]\d{7,14}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter the driver's name, Google email and phone number with country code.");
                const key = JSON.stringify([task.id, name, phone, email, vehicle.trim(), whatsappConsent]);
                if (driverRequest.current?.key !== key) driverRequest.current = { key, id: Crypto.randomUUID() };
                const saved = await api<Task>(`/tasks/${task.id}/driver`, "POST", {
                  id: driverRequest.current.id, version: task.version, name, phone, email,
                  vehicle: vehicle.trim(), whatsapp_consent: whatsappConsent,
                });
                const { driver_link: link, ...safe } = saved;
                setDriverLink(link);
                driverRequest.current = null;
                setTask({ ...task, ...safe } as Task);
                await remember("task:" + task.id, { ...task, ...safe });
                await stopTracking(task.id);
                await load(); await changed();
              }}>{task.driver ? "Reassign driver / renew link" : "Assign driver"}</Button>
            </>
          )}
          {driverLink && (
            <>
              <Info>WhatsApp: {label(driverLink.whatsapp_status)} · Link expires {new Date(driverLink.expires_at).toLocaleString()}</Info>
              <Info>Direct magic link: {driverLink.url}</Info>
              <Button secondary onPress={() => Linking.openURL(driverLink.whatsapp_url)}>Open WhatsApp with driver link</Button>
              <Button secondary onPress={() => Linking.openURL(driverLink.url)}>Open driver link in browser</Button>
            </>
          )}
          <Heading>Submitted proofs</Heading>
          {proofs.length ? proofs.map((item) => <View key={item.id}>
            <Info>{label(item.stage || item.kind)} · {label(item.status)}</Info>
            {item.location && <Info>Captured {new Date(item.captured_at).toLocaleString()} · Received {item.received_at ? new Date(item.received_at).toLocaleString() : 'upload pending'} · Near {item.location.area?.name || 'recorded location'} · Accuracy ±{Math.round(item.location.accuracy)} m{item.recipient ? ` · Received by ${item.recipient}` : ''}</Info>}
            {item.status === 'ready' && <Button secondary onPress={async () => { const { url } = await api(`/evidence/${item.id}/url`); await Linking.openURL(url); }}>View {label(item.stage || item.kind)} proof</Button>}
          </View>) : <Info>Waiting for the driver's proofs.</Info>}
        </Card>
      )}
      {task.status === "accepted" && (!transport || !task.driver) && (
        <Button
          onPress={async () =>
            action("start", {
              tracking_permission: transport
                ? await permission()
                : "unavailable",
            })
          }
        >
          Start {transport ? "trip" : "clearance work"}
        </Button>
      )}
      {task.status === "in_progress" && (!transport || !task.driver) && (
        <>
          {transport && task.tracking_status !== "active" && (
            <Button
              secondary
              onPress={async () =>
                action("resume-tracking", {
                  tracking_permission: await permission(),
                })
              }
            >
              Enable / resume trip tracking
            </Button>
          )}
          <Card>
            <Heading>Progress</Heading>
            <Field label="Actual event time (optional, include timezone)" value={actualTime} set={setActualTime} />
            <Info>Leave blank to use now. The system records the submission time separately.</Info>
            {transport && (
              <Info>
                Tracking: {label(task.tracking_status)}. Location updates depend
                on background permission and device settings.
              </Info>
            )}
            <Field
              label="Exception / update notes"
              value={reason}
              set={setReason}
              multiline
            />
            <View style={styles.row}>
              {(transport
                ? [
                    "en_route",
                    "arrived",
                    task.kind === "pickup" ? "collected" : "delivered",
                  ]
                : [
                    "documents_requested",
                    "filed",
                    "examination",
                    "hold",
                    "cleared",
                  ]
              ).map((milestone) => (
                <Button
                  key={milestone}
                  secondary
                  onPress={() => action("progress", { milestone, reason })}
                >
                  {label(milestone)}
                </Button>
              ))}
            </View>
          </Card>
          <Card>
            <Heading>Completion proof</Heading>
            <View style={styles.row}>
              {(transport
                ? ["photo", "signature"]
                : ["clearance_document", "photo"]
              ).map((kind) => (
                <Choice
                  key={kind}
                  selected={kind === proofKind}
                  onPress={() => setProofKind(kind)}
                >
                  {label(kind)}
                </Choice>
              ))}
            </View>
            <Button
              secondary
              onPress={async () => {
                const item = await proof(task.id, proofKind, true);
                if (item) setProofs([...proofs, item]);
                await synchronize();
                await load();
              }}
            >
              Take proof photo
            </Button>
            <Button
              secondary
              onPress={async () => {
                const item = await proof(task.id, proofKind, false);
                if (item) setProofs([...proofs, item]);
                await synchronize();
                await load();
              }}
            >
              Choose proof file
            </Button>
            {proofs.map((p) => (
              <Info key={p.id}>
                {label(p.kind)} · {label(p.status)}
              </Info>
            ))}
            {transport ? (
              <Field
                label="Handover recipient / site representative"
                value={recipient}
                set={setRecipient}
              />
            ) : (
              <Field
                label="Clearance reference"
                value={reference}
                set={setReference}
              />
            )}
            <Button
              onPress={() =>
                action("submit-completion", {
                  recipient,
                  clearance_reference: reference,
                  evidence_ids: [...new Set(proofs.map((p) => p.id))],
                })
              }
            >
              Submit for staff verification
            </Button>
            <Text style={styles.muted}>
              Offline submissions remain pending until every proof file is
              uploaded. Staff verify the completed work.
            </Text>
          </Card>
        </>
      )}
      {task.events?.map((event: Json) => (
        <Card key={event.id}>
          <Info>
            {label(event.payload?.milestone || event.kind)}
          </Info>
          <Info>Occurred at: {new Date(event.occurred_at || event.captured_at).toLocaleString()}</Info>
          <Text style={styles.muted}>Recorded at: {event.created_at ? new Date(event.created_at).toLocaleString() : "Pending synchronization"}</Text>
          {event.payload?.reason && <Info>{event.payload.reason}</Info>}
        </Card>
      ))}
    </>
  );
}

export function PendingWork({ reload }: { reload: () => Promise<void> }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof pending>>>([]);
  useEffect(() => {
    void pending().then(setItems);
    const timer = setInterval(() => {
      void pending().then(setItems);
    }, 5000);
    return () => clearInterval(timer);
  }, []);
  if (!items.length) return null;
  return (
    <Card>
      <Heading>{items.length} pending sync items</Heading>
      <Button
        secondary
        onPress={async () => {
          await synchronize();
          setItems(await pending());
          await reload();
        }}
      >
        Synchronize now
      </Button>
      {[
        ...new Set(
          items.filter((item) => item.error).map((item) => item.resource_id),
        ),
      ].map((id) => (
        <View key={id} style={{ gap: 8 }}>
          <Text style={styles.error}>
            {items.find((item) => item.resource_id === id && item.error)?.error}
          </Text>
          <Button
            secondary
            onPress={() =>
              Alert.alert(
                "Discard pending work?",
                "Review the current task first. Discarding removes its unsent updates and proof from this device.",
                [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => {
                      void discardResource(id).then(async () => {
                        setItems(await pending());
                        await reload();
                      });
                    },
                  },
                ],
              )
            }
          >
            Discard reviewed pending work
          </Button>
        </View>
      ))}
    </Card>
  );
}

export function WarehouseSpace({
  enquiries,
  reservations,
  reload,
}: {
  enquiries: Json[];
  reservations: Json[];
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Json | null>(null),
    [base, setBase] = useState("0"),
    [handling, setHandling] = useState("0"),
    [tax, setTax] = useState("0"),
    [currency, setCurrency] = useState("INR"),
    [terms, setTerms] = useState(""),
    [expiry, setExpiry] = useState(""),
    [recipient, setRecipient] = useState("");
  const [proofs, setProofs] = useState<Record<string, string[]>>({}),
    [quantity, setQuantity] = useState("");
  return (
    <>
      {!enquiries.length && (
        <Card>
          <Info>Warehouse enquiries will appear here.</Info>
        </Card>
      )}
      {enquiries.map((enquiry) => (
        <Card key={enquiry.id}>
          <Text style={styles.muted}>{enquiry.company_name}</Text>
          <Heading>
            {enquiry.job_reference} · {enquiry.quantity} {enquiry.unit}
          </Heading>
          <Info>
            {new Date(enquiry.starts_at).toLocaleString()} →{" "}
            {new Date(enquiry.ends_at).toLocaleString()}
          </Info>
          <Info>{enquiry.requirements?.cargo_description}</Info>
          <Info>
            {enquiry.requirements?.handling} {enquiry.requirements?.storage}
          </Info>
          <Info>{label(enquiry.status)}</Info>
          {enquiry.requests.map((request: Json) => (
            <View key={request.id} style={{ gap: 8 }}>
              <Heading>
                {request.warehouse_name} · {request.pool_name}
              </Heading>
              <Info>{label(request.status)}</Info>
              {request.offers.map((offer: Json) => (
                <Info key={offer.id}>
                  {offer.quantity} {enquiry.unit} · {offer.currency}{" "}
                  {Number(offer.base_price) +
                    Number(offer.handling_charge) +
                    Number(offer.tax_amount)}{" "}
                  · {offer.terms} · until{" "}
                  {new Date(offer.valid_until).toLocaleString()}
                </Info>
              ))}
              {enquiry.status === "open" && request.status !== "declined" && (
                <Button
                  secondary
                  onPress={() => {
                    setSelected(request);
                    setQuantity(String(enquiry.quantity));
                  }}
                >
                  Quote availability
                </Button>
              )}
              {enquiry.status === "pending_confirmation" &&
                request.offers.some(
                  (offer: Json) => offer.id === enquiry.selected_offer_id,
                ) && (
                  <Button
                    onPress={async () => {
                      if (!(await online()))
                        throw new Error(
                          "Reservation confirmation needs an internet connection.",
                        );
                      await api(
                        `/space-requests/${request.id}/confirm`,
                        "POST",
                      );
                      await reload();
                    }}
                  >
                    Confirm selected reservation
                  </Button>
                )}
              {["open", "pending_confirmation"].includes(enquiry.status) && (
                <Button
                  secondary
                  onPress={async () => {
                    await api(`/space-requests/${request.id}/decline`, "POST", {
                      id: request.id,
                      reason: "Unavailable",
                    });
                    await reload();
                  }}
                >
                  Decline request
                </Button>
              )}
            </View>
          ))}
        </Card>
      ))}
      {selected && (
        <Card>
          <Heading>Quotation · {selected.warehouse_name}</Heading>
          <Info>
            Specify the available quantity for the requested dates. Capacity is
            committed when you confirm the selected offer.
          </Info>
          <Field
            label="Available quantity"
            value={quantity}
            set={setQuantity}
            keyboardType="decimal-pad"
          />
          <Field
            label="Storage price (total for the quoted quantity and dates)"
            value={base}
            set={setBase}
            keyboardType="decimal-pad"
          />
          <Field
            label="Handling charge"
            value={handling}
            set={setHandling}
            keyboardType="decimal-pad"
          />
          <Field
            label="Tax amount"
            value={tax}
            set={setTax}
            keyboardType="decimal-pad"
          />
          <Field
            label="Currency (3 letters)"
            value={currency}
            set={(v) => setCurrency(v.toUpperCase())}
          />
          <Field
            label="Conditions and booking terms"
            value={terms}
            set={setTerms}
            multiline
          />
          <Field
            label="Offer expiry (ISO date and time, e.g. 2026-12-01T18:00:00+05:30)"
            value={expiry}
            set={setExpiry}
          />
          <Button
            onPress={async () => {
              await api(`/space-requests/${selected.id}/offers`, "POST", {
                id: Crypto.randomUUID(),
                quantity: Number(quantity),
                base_price: Number(base),
                handling_charge: Number(handling),
                tax_amount: Number(tax),
                currency,
                terms,
                valid_until: new Date(expiry).toISOString(),
              });
              setSelected(null);
              await reload();
            }}
          >
            Send quotation
          </Button>
          <Button secondary onPress={() => setSelected(null)}>
            Close quotation
          </Button>
        </Card>
      )}
      {reservations.map((reservation) => (
        <Card key={reservation.id}>
          <Text style={styles.muted}>{reservation.company_name}</Text>
          <Heading>Reservation · {reservation.job_reference}</Heading>
          <Info>
            {reservation.quantity} · {label(reservation.status)}
          </Info>
          <Info>{reservation.terms_snapshot?.terms}</Info>
          {reservation.handovers.map((h: Json) => (
            <Info key={h.event_id}>
              {h.action} · {h.recipient} ·{" "}
              {new Date(h.captured_at).toLocaleString()}
            </Info>
          ))}
          {["confirmed", "received"].includes(reservation.status) && (
            <>
              <Field
                label="Handover recipient"
                value={recipient}
                set={setRecipient}
              />
              <Button
                secondary
                onPress={async () => {
                  const p = await proof(reservation.id, "receipt", true, true);
                  if (p)
                    setProofs({
                      ...proofs,
                      [reservation.id]: [
                        ...(proofs[reservation.id] || []),
                        p.id,
                      ],
                    });
                }}
              >
                Take handover proof
              </Button>
              <Info>
                {proofs[reservation.id]?.length || 0} proof files selected
              </Info>
              <Button
                onPress={async () => {
                  const uploads = (await pending())
                    .filter(
                      (q) =>
                        q.resource_id === reservation.id && q.kind === "upload",
                    )
                    .map((q) => q.payload.metadata.id);
                  const used = new Set(
                    reservation.handovers.flatMap(
                      (h: Json) => h.evidence_ids || [],
                    ),
                  );
                  const available = (reservation.evidence || [])
                    .filter((e: Json) => e.status === "ready")
                    .map((e: Json) => e.id);
                  const evidence = [
                    ...new Set([
                      ...(proofs[reservation.id] || []),
                      ...uploads,
                      ...available,
                    ]),
                  ].filter((id) => !used.has(id));
                  if (!recipient.trim() || !evidence.length)
                    throw new Error(
                      "Record the recipient and add a new handover proof.",
                    );
                  const body = {
                    event_id: Crypto.randomUUID(),
                    action:
                      reservation.status === "confirmed"
                        ? "received"
                        : "dispatched",
                    captured_at: new Date().toISOString(),
                    recipient,
                    evidence_ids: evidence,
                  };
                  await enqueue(
                    reservation.id,
                    "handover",
                    { body },
                    body.event_id,
                  );
                  await synchronize();
                  await reload();
                }}
              >
                Record{" "}
                {reservation.status === "confirmed" ? "receipt" : "dispatch"}
              </Button>
            </>
          )}
        </Card>
      ))}
    </>
  );
}

export function WarehouseListings({
  listings,
  reload,
}: {
  listings: Json[];
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [address, setAddress] = useState(""),
    [city, setCity] = useState(""),
    [country, setCountry] = useState("IN"),
    [facilities, setFacilities] = useState(""),
    [unit, setUnit] = useState("pallet"),
    [capacity, setCapacity] = useState("1"),
    [poolName, setPoolName] = useState("General storage");
  return (
    <>
      {listings.map((w) => (
        <Card key={w.id}>
          <Heading>{w.name}</Heading>
          <Info>
            {w.address}, {w.city}
          </Info>
          {w.pools.map((p: Json) => (
            <Info key={p.id}>
              {p.name} · {p.capacity} {p.unit}
            </Info>
          ))}
          <Button
            secondary
            onPress={async () => {
              await api(
                `/warehouses/${w.id}/active?active=${!w.active}`,
                "PATCH",
              );
              await reload();
            }}
          >
            {w.active ? "Hide listing" : "Activate listing"}
          </Button>
        </Card>
      ))}
      <Card>
        <Heading>Add a warehouse</Heading>
        <Field label="Warehouse name" value={name} set={setName} />
        <Field label="Address" value={address} set={setAddress} multiline />
        <Field label="City" value={city} set={setCity} />
        <Field
          label="Country code"
          value={country}
          set={(v) => setCountry(v.toUpperCase())}
        />
        <Field
          label="Facilities, separated by commas"
          value={facilities}
          set={setFacilities}
        />
        <Field label="Capacity pool name" value={poolName} set={setPoolName} />
        <View style={styles.row}>
          {["pallet", "sqft", "cbm"].map((u) => (
            <Choice key={u} selected={u === unit} onPress={() => setUnit(u)}>
              {u}
            </Choice>
          ))}
        </View>
        <Field
          label="Total capacity"
          value={capacity}
          set={setCapacity}
          keyboardType="decimal-pad"
        />
        <Button
          onPress={async () => {
            await api("/warehouses", "POST", {
              name,
              address,
              city,
              country,
              facilities: facilities
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              pools: [{ name: poolName, unit, capacity: Number(capacity) }],
            });
            setName("");
            await reload();
          }}
        >
          Create listing
        </Button>
      </Card>
    </>
  );
}

export function Inbox({
  items,
  reload,
  open,
}: {
  items: Json[];
  reload: () => Promise<void>;
  open: (item: Json) => void;
}) {
  return (
    <>
      {!items.length && (
        <Card>
          <Info>No notifications yet.</Info>
        </Card>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <Heading>
            {item.read_at ? "" : "● "}
            {item.title}
          </Heading>
          <Info>{item.body}</Info>
          <Text style={styles.muted}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
          <Button
            secondary
            onPress={async () => {
              await api(`/inbox/${item.id}/read`, "POST");
              open(item);
              await reload();
            }}
          >
            Open
          </Button>
        </Card>
      ))}
    </>
  );
}

export function NetworkAdmin() {
  const [profiles, setProfiles] = useState<Json[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void api<Json[]>("/admin/partners")
      .then(setProfiles)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Heading>Network verification</Heading>
      {error && <Text style={styles.error}>{error}</Text>}
      {profiles.map((profile) => (
        <Card key={profile.id}>
          <Heading>{profile.name}</Heading>
          <Info>
            {profile.phone} · {profile.email}
          </Info>
          <Info>
            {profile.capabilities.join(", ")} · {profile.credentials.join(", ")}
          </Info>
          <Info>{profile.verification}</Info>
          <View style={styles.row}>
            {["verified", "rejected", "pending"].map((status) => (
              <Button
                secondary
                key={status}
                onPress={async () => {
                  await api(
                    `/admin/partners/${profile.id}/verification`,
                    "POST",
                    { status, note: "Reviewed by network administrator" },
                  );
                  setProfiles(await api("/admin/partners"));
                }}
              >
                {label(status)}
              </Button>
            ))}
          </View>
        </Card>
      ))}
    </>
  );
}
