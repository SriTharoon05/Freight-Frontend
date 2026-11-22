"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  freight,
  type Entity,
  type EntityKind,
  type Page,
  type ChargeType,
  errorMessage,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
export const inputClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-[12px] text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition outline-none placeholder:text-slate-400 focus:border-[#685fd1] focus:ring-4 focus:ring-[#685fd1]/10 disabled:bg-slate-50";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6b62d4] to-[#5570de] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,91,210,0.24)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-[#685fd1]/40 hover:bg-[#f6f5ff] hover:text-[#584fc2] disabled:opacity-50";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.01em] text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/85 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_28px_-14px_rgba(15,23,42,0.07)] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#6b62d4] to-[#38bdf8]" />
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-slate-900">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-[#23294d] bg-gradient-to-r from-[#11162c] via-[#192142] to-[#212b54] p-5 text-white shadow-[0_12px_32px_-16px_rgba(15,23,42,0.45)] sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#38bdf8]/10 blur-3xl"
      />
      <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7dd3fc]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#38bdf8]" />
            {eyebrow}
          </span>
          <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const raw = String(status || "pending").toLowerCase();
  const label = raw.replaceAll("_", " ");
  let style = "bg-slate-100 text-slate-700 ring-slate-200";
  if (["delivered", "completed", "paid", "verified", "customs_import_cleared", "customs_export_cleared", "won", "accepted"].includes(raw)) {
    style = "bg-emerald-50 text-emerald-700 ring-emerald-200/80";
  } else if (["in_transit", "departed", "out_for_delivery", "picked_up", "issued", "sent", "generated", "quoted"].includes(raw)) {
    style = "bg-sky-50 text-sky-700 ring-sky-200/80";
  } else if (["booking_confirmed", "booked", "arrived", "arrived_at_destination_port", "awaiting_verification"].includes(raw)) {
    style = "bg-indigo-50 text-indigo-700 ring-indigo-200/80";
  } else if (["draft", "quote_draft", "pending", "customs_import_pending", "customs_export_pending", "on_hold"].includes(raw)) {
    style = "bg-amber-50 text-amber-800 ring-amber-200/80";
  } else if (["overdue", "critical", "failed", "cancelled", "rejected", "lost", "exception"].includes(raw)) {
    style = "bg-rose-50 text-rose-700 ring-rose-200/80";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold capitalize ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {label}
    </span>
  );
}

export function ModeBadge({ mode }: { mode?: string | null }) {
  const m = String(mode || "ocean").toLowerCase();
  const style =
    m === "air"
      ? "bg-sky-50 text-sky-700 ring-sky-200/80"
      : m === "road"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
        : m === "rail"
          ? "bg-amber-50 text-amber-800 ring-amber-200/80"
          : "bg-indigo-50 text-indigo-700 ring-indigo-200/80";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${style}`}>
      {m}
    </span>
  );
}
export function ErrorBanner({ error }: { error: unknown }) {
  return error ? (
    <p
      role="alert"
      className="my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700"
    >
      {errorMessage(error)}
    </p>
  ) : null;
}
export function Pager({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#858693]">
      <span>{total.toLocaleString()} {total === 1 ? "record" : "records"}</span>
      <div className="flex items-center gap-3">
        <button
          className={secondaryClass}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / limit))}
        </span>
        <button
          className={secondaryClass}
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function useDraft<T>(
  name: string,
  initial: T,
  options?: { autoRestore?: boolean },
) {
  const autoRestore = options?.autoRestore ?? true;
  const user = useAuthStore((s) => s.user);
  const key = `freight:draft:${user?.tenant_id}:${user?.id}:${name}`;
  const [value, setValue] = useState(initial);
  const [loadedKey, setLoadedKey] = useState("");
  const initialValue = useRef(initial);
  initialValue.current = initial;
  const ready = loadedKey === key;
  const [storageError, setStorageError] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const [savedDraft, setSavedDraft] = useState<T | null>(null);
  const skip = useRef(false);
  useEffect(() => {
    if (!user) return;
    skip.current = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSavedDraft(parsed);
        if (autoRestore) {
          setValue(parsed);
          setIsRestored(true);
        } else {
          setValue(JSON.parse(JSON.stringify(initialValue.current)));
          setIsRestored(false);
        }
      } else {
        setSavedDraft(null);
        setValue(JSON.parse(JSON.stringify(initialValue.current)));
        setIsRestored(false);
      }
    } catch {
      setStorageError(
        "Draft storage is unavailable. Keep this page open until saved.",
      );
    }
    setLoadedKey(key);
  }, [key, user, autoRestore]);
  useEffect(() => {
    if (!ready || skip.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setStorageError("Draft could not be saved on this device.");
    }
  }, [key, value, ready]);
  return {
    value,
    setValue,
    ready,
    storageError,
    isRestored,
    hasSavedDraft: Boolean(savedDraft),
    restoreDraft: () => {
      if (savedDraft) {
        skip.current = false;
        setValue(savedDraft);
        setIsRestored(true);
      }
    },
    discardDraft: () => {
      skip.current = true;
      try {
        localStorage.removeItem(key);
        localStorage.removeItem("new-job:");
        localStorage.removeItem("freight:draft:new-job:");
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes("draft") && k.includes("new-job")) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
      setSavedDraft(null);
      setIsRestored(false);
      setValue(JSON.parse(JSON.stringify(initialValue.current)));
    },
    clear: () => {
      skip.current = true;
      try {
        localStorage.removeItem(key);
        localStorage.removeItem("new-job:");
        localStorage.removeItem("freight:draft:new-job:");
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes("draft") && k.includes("new-job")) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
      setSavedDraft(null);
      setIsRestored(false);
      setValue(JSON.parse(JSON.stringify(initialValue.current)));
    },
  };
}
const labels: Record<EntityKind, string> = {
  contacts: "contact",
  third_party_agents: "third-party agent",
  customers: "customer",
  carriers: "carrier",
  staff: "staff member",
};
export function EntityAutocomplete({
  kind,
  value,
  onChange,
  label,
  required = false,
}: {
  kind: EntityKind;
  value?: Entity | null;
  onChange: (v: Entity | null) => void;
  label: string;
  required?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const client = useQueryClient();
  const id = useId();
  const [search, setSearch] = useState(value?.name || "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [active, setActive] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const selectedName = value?.name;
  useEffect(() => {
    if (selectedName !== undefined) setSearch(selectedName);
  }, [value?.id, selectedName]);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setActive(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const results = useQuery<Page<Entity>>({
    queryKey: ["freight", user?.tenant_id, "entity", kind, query],
    queryFn: () => freight.get<Page<Entity>>(`/entities/${kind}`, { q: query }),
    enabled: open && query.length >= 2,
  });
  const options = results.data?.items || [];
  const canCreate =
    kind !== "staff" || ["admin", "org_admin"].includes(user?.role || "");
  const choose = (entity: Entity) => {
    onChange(entity);
    setSearch(entity.name);
    setOpen(false);
  };
  const startCreate = () => {
    setForm({
      name: search,
      country: "",
      email: "",
      address: "",
      city: "",
      phone: "",
    });
    setError(null);
    setOpen(false);
    setDrawer(true);
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await freight.post<Entity>(`/entities/${kind}`, form);
      choose(created);
      setDrawer(false);
      client.invalidateQueries({
        queryKey: ["freight", user?.tenant_id, "entity", kind],
      });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="relative min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold text-[#777884]"
      >
        {label}
        {required ? " *" : ""}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open && query.length >= 2}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[active] ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          className={`${inputClass} pr-8`}
          value={search}
          required={required}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onChange={(e) => {
            setSearch(e.target.value);
            if (value) onChange(null);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((n) =>
                Math.min(
                  n + 1,
                  Math.max(0, options.length - (canCreate ? 0 : 1)),
                ),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((n) => Math.max(n - 1, 0));
            }
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            } else if (
              e.key === "Enter" &&
              open &&
              query.length >= 2 &&
              canCreate &&
              !results.isFetching &&
              !results.isError
            ) {
              e.preventDefault();
              startCreate();
            }
          }}
        />
        {value ? (
          <button
            aria-label={`Clear ${label}`}
            type="button"
            className="absolute right-2 top-3"
            onClick={() => {
              onChange(null);
              setSearch("");
            }}
          >
            <X size={13} />
          </button>
        ) : (
          <Search
            className="absolute right-2.5 top-3 text-[#a5a4b4]"
            size={14}
          />
        )}
      </div>
      {value?.address && (
        <p className="mt-1 text-[10px] text-[#858693]">
          {value.address} · {value.city} {value.country}
        </p>
      )}
      {open && query.length >= 2 && (
        <div
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[#e5e3ee] bg-white p-1 shadow-xl"
          id={`${id}-list`}
          role="listbox"
        >
          {results.isFetching && (
            <p className="p-3 text-xs text-[#858693]">Searching…</p>
          )}
          {results.isError && (
            <p role="alert" className="p-3 text-xs text-red-600">
              Search failed.{" "}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => results.refetch()}
              >
                Retry
              </button>
            </p>
          )}
          {options.map((entity: Entity, i: number) => (
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              id={`${id}-${i}`}
              key={entity.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(entity)}
              className={`block w-full rounded-lg p-3 text-left text-xs ${i === active ? "bg-[#f4f2ff]" : "hover:bg-[#f7f6fb]"}`}
            >
              <strong className="block font-medium">{entity.name}</strong>
              <span className="text-[10px] text-[#858693]">
                {entity.secondary || entity.email}
              </span>
            </button>
          ))}
          {(kind !== "staff" ||
            ["admin", "org_admin"].includes(user?.role || "")) &&
            !results.isFetching &&
            !results.isError && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startCreate}
                className="flex w-full items-center gap-2 border-t p-3 text-xs font-semibold text-[#7068cf]"
              >
                <Plus size={14} />
                Create new {labels[kind]}
              </button>
            )}
        </div>
      )}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent
          className="overflow-y-auto bg-white sm:max-w-lg"
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle>Create {labels[kind]}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {[
              ["name", "Name"],
              ["company", "Company"],
              ["address", "Address"],
              ["city", "City"],
              ["country", "Country code"],
              ["email", "Email"],
              ["phone", "Phone"],
              ...(kind === "staff"
                ? [
                    ["password", "Initial password (12 characters minimum)"],
                    ["role", "Role: sales / ops / finance / manager / admin"],
                  ]
                : []),
              ...(kind === "contacts"
                ? [["account_number", "Account number"]]
                : []),
              ...(kind === "third_party_agents"
                ? [
                    ["type", "Agent type"],
                    ["contact_name", "Contact name"],
                    ["ports_served", "Ports served"],
                    ["code", "SCAC / IATA code"],
                    ["rate_notes", "Rate notes"],
                  ]
                : []),
            ].map(([key, name]) => (
              <Field key={key} label={name}>
                {key === "address" ? (
                  <textarea
                    rows={3}
                    className={`${inputClass} resize-y min-h-[72px]`}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]: e.target.value,
                      })
                    }
                  />
                ) : (
                  <input
                    className={inputClass}
                    type={
                      key === "password"
                        ? "password"
                        : key === "email"
                          ? "email"
                          : "text"
                    }
                    maxLength={key === "country" ? 2 : undefined}
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]:
                          key === "country"
                            ? e.target.value.toUpperCase()
                            : e.target.value,
                      })
                    }
                  />
                )}
              </Field>
            ))}
            <ErrorBanner error={error} />
            <button
              type="button"
              className={buttonClass}
              disabled={saving || !form.name?.trim()}
              onClick={save}
            >
              {saving ? "Saving…" : "Save " + labels[kind]}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function ChargeSelect({
  value,
  name,
  onChange,
  mode,
}: {
  value: string;
  name?: string;
  onChange: (value: string, charge?: ChargeType, customName?: string) => void;
  mode?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState(name || "");
  const { data, error } = useQuery<Page<ChargeType>>({
    queryKey: ["freight", user?.tenant_id, "charge-schedule"],
    queryFn: () => freight.get<Page<ChargeType>>("/charge-schedule"),
  });

  const matching = data?.items.find((c: ChargeType) => c.id === value);

  if (customMode || (!matching && !value && customText)) {
    return (
      <div className="flex items-center gap-1">
        <input
          aria-label="Custom charge name"
          placeholder="Charge name (e.g. Documentation)"
          className={inputClass}
          value={customText}
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange("", undefined, e.target.value);
          }}
        />
        <button
          type="button"
          className="whitespace-nowrap px-1 text-[11px] font-semibold text-[#7068cf] hover:underline"
          onClick={() => {
            setCustomMode(false);
            setCustomText("");
            onChange("", undefined, "");
          }}
        >
          Select
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        className={inputClass}
        value={value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setCustomMode(true);
            return;
          }
          onChange(
            e.target.value,
            data?.items.find((c: ChargeType) => c.id === e.target.value),
            undefined,
          );
        }}
      >
        <option value="">Select charge</option>
        {data?.items
          .filter((c: ChargeType) => !mode || c.modes.includes(mode))
          .map((c: ChargeType) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        {value && !data?.items.some((c: ChargeType) => c.id === value) && (
          <option value={value}>{name || value}</option>
        )}
        <option value="__custom__">+ Enter custom charge name…</option>
      </select>
      <ErrorBanner error={error} />
    </div>
  );
}
