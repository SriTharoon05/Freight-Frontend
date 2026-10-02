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
  "w-full rounded-lg border border-[#e5e3ee] bg-white px-3 py-2.5 text-[12px] text-[#343444] outline-none focus:border-[#7068cf] focus:ring-2 focus:ring-[#7068cf]/10 disabled:bg-[#f7f6fb]";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#7068cf] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#6259c1] disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5e3ee] bg-white px-3 py-2 text-xs font-medium hover:bg-[#f4f2ff] disabled:opacity-50";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-semibold text-[#777884]">
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
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#eeecf5] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#343444]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
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
    <div className="mt-4 flex items-center justify-between text-xs text-[#858693]">
      <span>{total} records</span>
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
export function useDraft<T>(name: string, initial: T) {
  const user = useAuthStore((s) => s.user);
  const key = `freight:draft:${user?.tenant_id}:${user?.id}:${name}`;
  const [value, setValue] = useState(initial);
  const [loadedKey, setLoadedKey] = useState("");
  const initialValue = useRef(initial);
  const ready = loadedKey === key;
  const [storageError, setStorageError] = useState("");
  const skip = useRef(false);
  useEffect(() => {
    if (!user) return;
    skip.current = false;
    try {
      const raw = localStorage.getItem(key);
      setValue(raw ? JSON.parse(raw) : initialValue.current);
    } catch {
      setStorageError(
        "Draft storage is unavailable. Keep this page open until saved.",
      );
    }
    setLoadedKey(key);
  }, [key, user]);
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
    clear: () => {
      skip.current = true;
      localStorage.removeItem(key);
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
  useEffect(() => {
    if (value) setSearch(value.name);
  }, [value?.id, value?.name]);
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
  onChange,
  mode,
}: {
  value: string;
  onChange: (value: string, charge?: ChargeType) => void;
  mode?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const { data, error } = useQuery<Page<ChargeType>>({
    queryKey: ["freight", user?.tenant_id, "charge-schedule"],
    queryFn: () => freight.get<Page<ChargeType>>("/charge-schedule"),
  });
  return (
    <>
      <select
        required
        className={inputClass}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
            data?.items.find((c: ChargeType) => c.id === e.target.value),
          )
        }
      >
        <option value="">Select charge</option>
        {data?.items
          .filter((c: ChargeType) => !mode || c.modes.includes(mode))
          .map((c: ChargeType) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      <ErrorBanner error={error} />
    </>
  );
}
