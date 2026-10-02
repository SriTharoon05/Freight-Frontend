"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import {
  EntityAutocomplete,
  Panel,
  Field,
  ErrorBanner,
  inputClass,
  buttonClass,
  secondaryClass,
} from "@/components/freight/shared";
import {
  freight,
  type ChargeType,
  type Page,
  type Entity,
} from "@/lib/freight";
import { MailboxSettings, PasswordSettings } from "@/components/freight/mailbox-settings";
import { useAuthStore } from "@/lib/auth-store";
type Row = Record<string, any>;
const groups: Record<string, string[]> = {
  "Company Profile": [
    "name",
    "address",
    "city",
    "email",
    "phone",
    "logo_url",
    "iata_code",
    "agent_account_number",
    "tax_number",
    "bank_details",
    "default_payment_terms",
    "signature",
  ],
  "Outlook Integration": ["outlook_read_url", "polling_seconds"],
  Notifications: [
    "escalation_minutes",
    "dd_warning_days",
    "workload_threshold",
  ],
  "Document Defaults": [
    "handling",
    "freight_terms",
    "hawb_prefix",
    "hbl_prefix",
    "house_sequence_digits",
  ],
  "Commercial Controls": ["minimum_margin_percent"],
};
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user),
    client = useQueryClient(),
    [tab, setTab] = useState("Company Profile"),
    [form, setForm] = useState<Row>({}),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [charge, setCharge] = useState({
      name: "",
      calculation: "fixed",
      default_value: 0,
      currency: "USD",
      modes: ["ocean", "air", "road", "rail", "multimodal"],
      is_active: true,
    }),
    [staff, setStaff] = useState<Entity | null>(null),
    [manager, setManager] = useState<Entity | null>(null),
    [role, setRole] = useState("ops");
  const admin = ["admin", "org_admin"].includes(user?.role || "");
  const settings = useQuery<Row>({
    queryKey: ["freight", user?.tenant_id, "settings"],
    queryFn: () => freight.get<Row>("/settings"),
  });
  const charges = useQuery<Page<ChargeType>>({
    queryKey: ["freight", user?.tenant_id, "charge-schedule", "all"],
    queryFn: () =>
      freight.get<Page<ChargeType>>("/charge-schedule", {
        include_inactive: true,
      }),
  });
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      client.invalidateQueries({ queryKey: ["freight"] });
      toast.success("Saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <nav className="flex flex-wrap gap-2">
          {[...Object.keys(groups), "Charge Schedule", "Users and Roles", "Account Security"].map(
            (t) => (
              <button
                key={t}
                className={`${secondaryClass} ${t === tab ? "!bg-[#f4f2ff] !text-[#7068cf]" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        <ErrorBanner error={error || settings.error} />
        {tab === "Outlook Integration" && admin && <MailboxSettings />}
        {tab === "Account Security" && <PasswordSettings />}
        {groups[tab] && (
          <Panel title={tab}>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => freight.put("/settings", form));
              }}
            >
              {groups[tab].map((key) => (
                <Field label={key.replaceAll("_", " ")} key={key}>
                  {[
                    "address",
                    "bank_details",
                    "signature",
                    "handling",
                  ].includes(key) ? (
                    <textarea
                      rows={4}
                      disabled={!admin}
                      className={inputClass}
                      value={form[key] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  ) : key === "freight_terms" ? (
                    <select
                      className={inputClass}
                      disabled={!admin}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    >
                      <option>PPD</option>
                      <option>COLL</option>
                    </select>
                  ) : (
                    <input
                      disabled={!admin}
                      className={inputClass}
                      type={
                        typeof form[key] === "number"
                          ? "number"
                          : key === "email"
                            ? "email"
                            : key.endsWith("_url")
                              ? "url"
                              : "text"
                      }
                      value={form[key] ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]:
                            typeof form[key] === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
              ))}
              {admin && (
                <div className="md:col-span-2">
                  <button className={buttonClass} disabled={busy}>
                    Save settings
                  </button>
                </div>
              )}
            </form>
          </Panel>
        )}
        {tab === "Charge Schedule" && (
          <Panel title="Master charge schedule">
            <ErrorBanner error={charges.error} />
            <div className="space-y-2">
              {charges.data?.items.map((c: ChargeType) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-[#eeecf5] p-3 text-xs"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span>
                    {c.calculation} Â· {c.default_value} {c.currency}
                  </span>
                  {admin && (
                    <button
                      className={secondaryClass}
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          freight.put(`/charge-schedule/${c.id}`, {
                            name: c.name,
                            calculation: c.calculation,
                            default_value: c.default_value,
                            currency: c.currency,
                            modes: c.modes,
                            is_active: !c.is_active,
                          }),
                        )
                      }
                    >
                      {c.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {admin && (
              <form
                className="mt-5 grid gap-3 md:grid-cols-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => freight.post("/charge-schedule", charge));
                }}
              >
                <Field label="Charge name">
                  <input
                    required
                    className={inputClass}
                    value={charge.name}
                    onChange={(e) =>
                      setCharge({ ...charge, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Calculation">
                  <select
                    className={inputClass}
                    value={charge.calculation}
                    onChange={(e) =>
                      setCharge({ ...charge, calculation: e.target.value })
                    }
                  >
                    {["fixed", "pct_of_base", "per_kg", "per_cbm"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Default value">
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="any"
                    value={charge.default_value}
                    onChange={(e) =>
                      setCharge({
                        ...charge,
                        default_value: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <button disabled={busy} className={buttonClass}>
                  Add charge type
                </button>
              </form>
            )}
          </Panel>
        )}
        {tab === "Users and Roles" && (
          <Panel title="Team hierarchy">
            {admin ? (
              <div className="grid gap-4 md:grid-cols-3">
                <EntityAutocomplete
                  kind="staff"
                  label="Staff member"
                  value={staff}
                  onChange={(v) => {
                    setStaff(v);
                    setRole(v?.role || "ops");
                  }}
                />
                <EntityAutocomplete
                  kind="staff"
                  label="Reports to"
                  value={manager}
                  onChange={setManager}
                />
                <Field label="Role">
                  <select
                    className={inputClass}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {[
                      "sales",
                      "ops",
                      "finance",
                      "manager",
                      "admin",
                      "org_admin",
                      "ops_manager",
                      "ops_agent",
                      "readonly",
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <button
                  disabled={!staff || busy}
                  className={buttonClass}
                  onClick={() =>
                    run(() =>
                      freight.put(`/staff/${staff?.id}`, {
                        role,
                        manager_id: manager?.id || null,
                      }),
                    )
                  }
                >
                  Save role & manager
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#858693]">
                User administration requires an administrator role.
              </p>
            )}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
