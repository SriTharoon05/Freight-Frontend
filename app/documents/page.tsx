"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import {
  Panel,
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
        <h1 className="text-2xl font-semibold">Documents</h1>
        <div className="flex gap-3">
          <select
            aria-label="Document type"
            className={inputClass}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
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
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <Panel title="Document register">
          <ErrorBanner error={result.error} />
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-[#858693]">
                  {[
                    "Document",
                    "Job / Customer",
                    "ETD",
                    "ETA",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th className="p-3" key={i}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data?.items.map((d: Row) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-3">
                      <strong>{d.number || d.type.replaceAll("_", " ")}</strong>
                      <p className="mt-1 uppercase text-[#858693]">
                        {d.type.replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="p-3">
                      {d.job_reference}
                      <p className="mt-1 text-[#858693]">{d.customer}</p>
                    </td>
                    <td className="p-3">{dateLabel(d.etd)}</td>
                    <td className="p-3">{dateLabel(d.eta)}</td>
                    <td className="p-3 capitalize">{d.status}</td>
                    <td className="p-3">
                      <Link
                        className="font-semibold text-[#7068cf]"
                        href={`/shipments/${d.shipment_id}?tab=Documents`}
                      >
                        Open document file
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.data?.total === 0 && (
            <p className="p-6 text-sm text-[#858693]">No matching documents.</p>
          )}
          <Pager
            page={page}
            limit={20}
            total={result.data?.total || 0}
            onChange={setPage}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
