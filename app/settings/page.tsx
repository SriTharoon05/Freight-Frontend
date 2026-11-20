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
    "contact_person",
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
  "Quotation Defaults": [
    "default_profit_margin_percent",
    "default_pricing_method",
    "default_documentation_fee",
    "default_documentation_currency",
    "default_quote_currency",
    "default_quote_tax_percent",
    "default_quote_validity_days",
    "default_air_divisor",
    "quotation_terms_and_conditions",
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
              {groups[tab].map((key) => {
                const labelMap: Record<string, string> = {
                  contact_person: "Default quote contact / prepared by",
                  logo_url: "Company logo (rendered on Quotations, HBL & HAWB)",
                  iata_code: "IATA cargo agent code (optional)",
                  default_profit_margin_percent: "Default profit / markup (%)",
                  default_pricing_method: "Default pricing method",
                  default_documentation_fee: "Default documentation fee",
                  default_documentation_currency: "Documentation fee currency",
                  default_quote_currency: "Default quote currency",
                  default_quote_tax_percent: "Default quote tax (%)",
                  default_quote_validity_days: "Default quote validity (days)",
                  default_air_divisor: "Default air volumetric divisor",
                };
                if (key === "logo_url") {
                  return (
                    <div key={key} className="md:col-span-2 rounded-xl border border-[#e5e3ee] bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-900">
                            {labelMap.logo_url}
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Upload a PNG, JPG, or WebP logo (recommended horizontal aspect ratio ~3.5:1, e.g. 380×104 px). Click <strong>Save settings</strong> after uploading.
                          </p>
                          <div className="pt-1.5 flex flex-wrap items-center gap-2">
                            <label className={`${secondaryClass} cursor-pointer ${!admin ? "pointer-events-none opacity-50" : ""}`}>
                              <span>Upload logo file</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                disabled={!admin}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (!file) return;
                                  if (file.size > 4 * 1024 * 1024) {
                                    toast.error("Logo file must be under 4 MB");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const rawData = typeof reader.result === "string" ? reader.result : "";
                                    if (!rawData) return;
                                    const img = new window.Image();
                                    img.onload = () => {
                                      const maxW = 380;
                                      const maxH = 104;
                                      const scale = Math.min(1, maxW / (img.width || 1), maxH / (img.height || 1));
                                      const targetW = Math.max(1, Math.round(img.width * scale));
                                      const targetH = Math.max(1, Math.round(img.height * scale));
                                      const canvas = document.createElement("canvas");
                                      canvas.width = targetW;
                                      canvas.height = targetH;
                                      const ctx = canvas.getContext("2d");
                                      if (ctx) {
                                        ctx.clearRect(0, 0, targetW, targetH);
                                        ctx.drawImage(img, 0, 0, targetW, targetH);
                                        const optimized = canvas.toDataURL("image/png");
                                        setForm((prev) => ({ ...prev, logo_url: optimized }));
                                        toast.success("Logo loaded — click 'Save settings' to apply across quotations & documents");
                                      } else {
                                        setForm((prev) => ({ ...prev, logo_url: rawData }));
                                      }
                                    };
                                    img.onerror = () => toast.error("Could not decode image file");
                                    img.src = rawData;
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                            {form.logo_url && admin && (
                              <button
                                type="button"
                                className={secondaryClass}
                                onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
                              >
                                Remove logo
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Exact 190x52 Quotation Document Header Slot Preview */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            Quotation Header Slot (190 × 52 px)
                          </span>
                          <div className="flex h-[56px] w-[198px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-1.5 shadow-sm">
                            {form.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={form.logo_url}
                                alt="Company Logo Preview"
                                className="max-h-[48px] max-w-[186px] object-contain"
                              />
                            ) : (
                              <div className="text-center">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Company Logo
                                </div>
                                <div className="text-[9px] text-slate-400">No logo uploaded</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                <Field label={labelMap[key] || key.replaceAll("_", " ")} key={key}>
                  {[
                    "address",
                    "bank_details",
                    "signature",
                    "handling",
                    "quotation_terms_and_conditions",
                  ].includes(key) ? (
                    <textarea
                      rows={key === "quotation_terms_and_conditions" ? 7 : 4}
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
                  ) : key === "default_pricing_method" ? (
                    <select
                      className={inputClass}
                      disabled={!admin}
                      value={form[key] || "margin"}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    >
                      <option value="margin">Gross Margin % (Sell = Cost / (1 − %))</option>
                      <option value="markup">Cost Markup % (Sell = Cost × (1 + %))</option>
                    </select>
                  ) : key === "default_air_divisor" ? (
                    <select
                      className={inputClass}
                      disabled={!admin}
                      value={form[key] || "standard"}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    >
                      <option value="standard">Standard Air (6,000 cm³/kg · 166 in³/lb)</option>
                      <option value="express">Express Courier (5,000 cm³/kg · 139 in³/lb)</option>
                    </select>
                  ) : key === "default_documentation_currency" || key === "default_quote_currency" ? (
                    <select
                      className={inputClass}
                      disabled={!admin}
                      value={form[key] || "USD"}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    >
                      {["USD", "INR", "EUR", "GBP", "AED", "SGD"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled={!admin}
                      className={inputClass}
                      min={typeof form[key] === "number" ? "0" : undefined}
                      step={typeof form[key] === "number" ? "any" : undefined}
                      type={
                        typeof form[key] === "number" ||
                        [
                          "default_profit_margin_percent",
                          "default_documentation_fee",
                          "default_quote_tax_percent",
                          "default_quote_validity_days",
                        ].includes(key)
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
                            typeof form[key] === "number" ||
                            [
                              "default_profit_margin_percent",
                              "default_documentation_fee",
                              "default_quote_tax_percent",
                              "default_quote_validity_days",
                            ].includes(key)
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
                );
              })}
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
                    {c.calculation} - {c.default_value} {c.currency}
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
