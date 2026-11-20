"use client";

import { useState, useEffect, useId, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { freight } from "@/lib/freight";
import { Plane, Anchor, Building2, MapPin } from "lucide-react";

export interface LocationItem {
  id: string;
  code: string;
  name: string;
  country_code: string;
  location_type: string;
  display: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  label,
  required = false,
  mode = "air",
  placeholder,
  readOnly = false,
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (loc: LocationItem) => void;
  label: string;
  required?: boolean;
  mode?: "air" | "ocean" | "road" | "rail" | "multimodal" | string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}) {
  const id = useId();
  const [search, setSearch] = useState(value || "");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setSearch(value);
    }
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setActive(0);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  // Determine location type filter based on mode
  const locationType =
    mode === "air"
      ? "AIRPORT"
      : mode === "ocean"
        ? "SEAPORT"
        : undefined;

  const results = useQuery<LocationItem[]>({
    queryKey: ["freight-locations", locationType, debounced],
    queryFn: async () => {
      const params: Record<string, string> = { q: debounced, limit: "25" };
      if (locationType) params.type = locationType;
      return freight.get<LocationItem[]>("/locations", params);
    },
    enabled: open && debounced.length >= 2,
    staleTime: 60000,
  });

  const options = results.data || [];

  const choose = (loc: LocationItem) => {
    // Standard IATA code or Port code with name
    const formatted = `${loc.code} - ${loc.name}`;
    setSearch(formatted);
    onChange(formatted);
    if (onSelect) onSelect(loc);
    setOpen(false);
  };

  const getIcon = (type?: string) => {
    if (type === "AIRPORT") return <Plane size={13} className="text-sky-600 shrink-0" />;
    if (type === "SEAPORT") return <Anchor size={13} className="text-teal-600 shrink-0" />;
    if (type === "ICD") return <Building2 size={13} className="text-amber-600 shrink-0" />;
    return <MapPin size={13} className="text-slate-400 shrink-0" />;
  };

  return (
    <div className={`relative min-w-0 ${className}`} ref={containerRef}>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold text-[#777884]">
        {label}
        {required ? " *" : ""}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          readOnly={readOnly}
          required={required}
          placeholder={placeholder || (mode === "air" ? "e.g. AMD, AUH, DXB, JFK" : "e.g. INNSA, CNSHA, SGSIN")}
          className="w-full rounded-lg border border-[#e2e1ec] bg-white px-3 py-2 text-xs font-medium text-[#2d2e3e] shadow-sm transition placeholder:text-[#9b9ca8] focus:border-[#7068cf] focus:outline-none focus:ring-2 focus:ring-[#7068cf]/20 read-only:bg-slate-50"
          value={search}
          onFocus={() => {
            if (!readOnly) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || options.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((prev) => (prev + 1) % options.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((prev) => (prev - 1 + options.length) % options.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (options[active]) choose(options[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {results.isFetching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#7068cf] border-t-transparent" />
          </div>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#e2e1ec] bg-white p-1 shadow-lg">
          {results.isFetching && options.length === 0 && (
            <p className="p-2.5 text-xs text-[#858693]">Searching {locationType ? `${locationType.toLowerCase()}s` : "ports & airports"}…</p>
          )}
          {!results.isFetching && options.length === 0 && (
            <p className="p-2.5 text-xs text-[#858693]">
              No matching location found. You can type freely or use a 3-letter IATA code.
            </p>
          )}
          {options.map((item: LocationItem, idx: number) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition ${
                idx === active ? "bg-[#f4f2ff] text-[#7068cf]" : "text-[#2d2e3e] hover:bg-[#f7f6fb]"
              }`}
            >
              {getIcon(item.location_type)}
              <span className="font-mono font-bold tracking-wide text-[#2d2e3e]">
                {item.code}
              </span>
              <span className="truncate text-[11px] text-slate-600">
                {item.name}
                {item.country_code ? `, ${item.country_code}` : ""}
              </span>
              <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 uppercase">
                {item.location_type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
