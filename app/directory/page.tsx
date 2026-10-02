"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import {
  EntityAutocomplete,
  Panel,
  Pager,
  ErrorBanner,
  inputClass,
  secondaryClass,
} from "@/components/freight/shared";
import {
  freight,
  type Entity,
  type EntityKind,
  type Page,
} from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";
export default function DirectoryPage() {
  const user = useAuthStore((s) => s.user),
    [kind, setKind] = useState<EntityKind>("contacts"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const list = useQuery<Page<Entity>>({
    queryKey: ["freight", user?.tenant_id, "entity", kind, search, page],
    queryFn: () =>
      freight.get<Page<Entity>>(`/entities/${kind}`, {
        q: search,
        page,
        limit: 20,
      }),
  });
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Directory</h1>
        <nav className="flex flex-wrap gap-2">
          {(
            [
              "contacts",
              "third_party_agents",
              "customers",
              "carriers",
              "staff",
            ] as EntityKind[]
          ).map((k) => (
            <button
              key={k}
              className={`${secondaryClass} ${kind === k ? "!bg-[#f4f2ff] !text-[#7068cf]" : ""}`}
              onClick={() => {
                setKind(k);
                setSearch("");
                setPage(1);
              }}
            >
              {k.replaceAll("_", " ")}
            </button>
          ))}
        </nav>
        <Panel title={kind.replaceAll("_", " ")}>
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <input
              aria-label="Search directory"
              className={inputClass}
              value={search}
              placeholder="Search directory"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <EntityAutocomplete
              kind={kind}
              label="Find or create"
              onChange={(v) => {
                if (v) setSearch(v.name);
              }}
            />
          </div>
          <ErrorBanner error={list.error} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data?.items.map((p: Entity) => (
              <article
                key={p.id}
                className="rounded-xl border border-[#eeecf5] p-5"
              >
                <h2 className="text-sm font-semibold">{p.name}</h2>
                <p className="mt-1 text-[10px] text-[#7068cf]">{p.secondary}</p>
                <p className="mt-3 whitespace-pre-line text-xs text-[#858693]">
                  {p.address}
                </p>
                <a
                  className="mt-2 block text-xs text-[#7068cf]"
                  href={`mailto:${p.email}`}
                >
                  {p.email}
                </a>
              </article>
            ))}
          </div>
          <Pager
            page={page}
            total={list.data?.total || 0}
            limit={20}
            onChange={setPage}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
