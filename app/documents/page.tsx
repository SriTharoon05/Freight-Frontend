"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
  PageHero,
  StatusBadge,
  Pager,
  ErrorBanner,
  inputClass,
} from "@/components/freight/shared";
import { freight, type Page, dateLabel } from "@/lib/freight";
import { useAuthStore } from "@/lib/auth-store";

type Row = Record<string, any>;

export default function DocumentsPage() {
  const user = useAuthStore((s) => s.user),
    [page, setPage] = useState(1),
    [type, setType] = useState(""),
    [status, setStatus] = useState("");
  const result = useQuery<Page<Row>>({
    queryKey: [
      "freight",
      user?.tenant_id,
      "document-register",
      page,
      type,
      status,
    ],
    queryFn: () =>
      freight.get<Page<Row>>("/document-register", { page, type, status }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHero
          eyebrow="Trade & Customs Documentation"
          title="Global Document Register"
          subtitle="Centralized repository for House & Master Bills of Lading, Air Waybills, Commercial Invoices, Arrival Notices, Pickup/Warehouse Receipts, and Proofs of Delivery."
        />

        <Panel
          title="Document register"
          action={
            <span className="text-xs font-medium tabular-nums text-slate-500">
              {result.data?.total ?? 0} documents
            </span>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 md:max-w-xl">
            <select
              aria-label="Document type"
              className={inputClass}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All document types</option>
              {[
                "hawb",
                "mawb",
                "hbl",
                "mbl",
                "invoice",
                "debit_note",
                "credit_note",
                "packing_list",
                "arrival_notice",
                "delivery_order",
                "pickup_receipt",
                "warehouse_receipt",
                "commercial_invoice",
                "shipping_bill",
                "house_bill_of_lading",
                "proof_of_delivery",
              ].map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
            <select
              aria-label="Document status"
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                "draft",
                "issued",
                "sent",
                "paid",
                "generated",
                "verified",
                "pending",
                "failed",
              ].map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <ErrorBanner error={result.error} />
          <div className="overflow-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    "Document / Reference",
                    "Job & Customer",
                    "ETD",
                    "ETA",
                    "Status",
                    "Actions",
                  ].map((h, i) => (
                    <th className="border-b border-slate-200/80 px-3.5 py-3" key={i}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.data?.items.map((d: Row) => (
                  <tr key={d.id} className="transition-colors hover:bg-[#f7f6ff]/70">
                    <td className="px-3.5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f0fe] text-[#5e54c8]">
                          <FileText size={14} />
                        </span>
                        <div>
                          <strong className="text-slate-900">
                            {d.number || d.type.replaceAll("_", " ").toUpperCase()}
                          </strong>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {d.type.replaceAll("_", " ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5">
                      <span className="font-semibold text-slate-800">{d.job_reference}</span>
                      <p className="mt-0.5 text-[11px] text-slate-500">{d.customer}</p>
                    </td>
                    <td className="px-3.5 tabular-nums text-slate-600">{dateLabel(d.etd)}</td>
                    <td className="px-3.5 tabular-nums text-slate-600">{dateLabel(d.eta)}</td>
                    <td className="px-3.5">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-3.5">
                      <Link
                        className="rounded-lg bg-[#f2f0fe] px-2.5 py-1 text-[11px] font-semibold text-[#5b52c4] transition hover:bg-[#e5e1fc]"
                        href={`/shipments/${d.job_id}?tab=Documents`}
                      >
                        Open Job →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.data?.total === 0 && (
              <p className="p-8 text-center text-xs text-slate-500">
                No documents match the selected filters.
              </p>
            )}
          </div>
          <Pager
            page={page}
            total={result.data?.total || 0}
            limit={20}
            onChange={setPage}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
