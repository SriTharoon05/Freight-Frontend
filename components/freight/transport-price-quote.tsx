"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Copy, Save, AlertCircle, Plus, Trash2, CheckCircle, FileText, Edit3, Eye } from "lucide-react";
import { toast } from "sonner";
import { freight, errorMessage } from "@/lib/freight";
import { buttonClass, secondaryClass, inputClass, Field, ErrorBanner } from "./shared";

type Row = Record<string, any>;

export type TransportPriceQuoteProps = {
  rfq: Row;
  onClose?: () => void;
  onSaved?: () => void;
};

export type QuoteLineItem = {
  id: string;
  description: string;
  qty: string;
  unit_price: number;
  subtotal: number;
  tax: number;
};

const DEFAULT_TERMS = `1. Quote validity is subject to the stated Valid Through date.
2. Rates are based on carrier tariff rates and current fuel surcharges; subject to change with notice.
3. Excludes destination customs duty, local taxes, storage, demurrage, and detention unless expressly included.
4. Transport is subject to standard carrier terms and conditions and space/equipment availability.
5. Payment terms: As agreed in company credit policy.`;

export function TransportPriceQuoteModal({ rfq, onClose, onSaved }: TransportPriceQuoteProps) {
  const [activeTab, setActiveTab] = useState<"document" | "editor">("document");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch company settings to get Sender info and standard Terms & Conditions
  const settingsQuery = useQuery<Row>({
    queryKey: ["freight", "settings"],
    queryFn: () => freight.get<Row>("/settings"),
  });

  // Fetch RFQ details for rich customer & line item context
  const rfqQuery = useQuery<Row>({
    queryKey: ["freight", "rfq-detail", rfq.id],
    queryFn: () => freight.get<Row>("/rfqs/" + rfq.id),
  });

  const settings = settingsQuery.data || {};
  const rfqDetail = rfqQuery.data || rfq;
  const customer = (rfqDetail.customer || {}) as Row;

  // Sender details
  const [senderName, setSenderName] = useState("");
  const [senderAddr1, setSenderAddr1] = useState("");
  const [senderAddr2, setSenderAddr2] = useState("");
  const [senderAddr3, setSenderAddr3] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  // Receiver details
  const [receiverName, setReceiverName] = useState("");
  const [receiverAddr1, setReceiverAddr1] = useState("");
  const [receiverAddr2, setReceiverAddr2] = useState("");
  const [receiverAddr3, setReceiverAddr3] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");

  // Meta info
  const [quoteNumber, setQuoteNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [validThrough, setValidThrough] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [taxPercent, setTaxPercent] = useState(10);

  // Items
  const [items, setItems] = useState<QuoteLineItem[]>([]);

  // Terms and conditions
  const [terms, setTerms] = useState("");

  // Initialize from RFQ and settings
  useEffect(() => {
    if (settingsQuery.data) {
      setSenderName((prev) => prev || settings.name || "Freight Forwarding Co.");
      setSenderAddr1((prev) => prev || settings.address || "");
      setSenderAddr2((prev) => prev || settings.city || "");
      setSenderAddr3((prev) => prev || (settings.tax_number ? `Tax ID: ${settings.tax_number}` : ""));
      setSenderPhone((prev) => prev || settings.phone || "");
      setSenderEmail((prev) => prev || settings.email || "");
      if (!terms) {
        setTerms(settings.quotation_terms_and_conditions || DEFAULT_TERMS);
      }
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setIssueDate(today);

    // Initial Quote Number
    setQuoteNumber(rfqDetail.reference || `QT-${Date.now().toString().slice(-6)}`);

    // Validity
    if (rfqDetail.validity) {
      try {
        setValidThrough(new Date(rfqDetail.validity).toISOString().split("T")[0]);
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        setValidThrough(d.toISOString().split("T")[0]);
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setValidThrough(d.toISOString().split("T")[0]);
    }

    // Customer / Receiver details
    const cust = (rfqDetail.customer || {}) as Row;
    setReceiverName(cust.name || rfqDetail.customer_name || "");
    setReceiverAddr1(cust.address || "");
    setReceiverAddr2(cust.city || "");
    setReceiverAddr3(cust.country || "");
    setReceiverPhone(cust.phone || "");
    setReceiverEmail(cust.email || "");

    // Existing saved quotation document or lines
    const savedDoc = rfqDetail.form?.quotation_document;
    if (savedDoc && Array.isArray(savedDoc.items) && savedDoc.items.length > 0) {
      setItems(savedDoc.items);
      if (savedDoc.terms) setTerms(savedDoc.terms);
      if (savedDoc.quote_number) setQuoteNumber(savedDoc.quote_number);
      if (savedDoc.tax_percent !== undefined) setTaxPercent(savedDoc.tax_percent);
      if (savedDoc.sender_name) setSenderName(savedDoc.sender_name);
      if (savedDoc.sender_addr1) setSenderAddr1(savedDoc.sender_addr1);
      if (savedDoc.sender_addr2) setSenderAddr2(savedDoc.sender_addr2);
      if (savedDoc.sender_addr3) setSenderAddr3(savedDoc.sender_addr3);
      if (savedDoc.sender_phone) setSenderPhone(savedDoc.sender_phone);
      if (savedDoc.sender_email) setSenderEmail(savedDoc.sender_email);
      if (savedDoc.receiver_name) setReceiverName(savedDoc.receiver_name);
      if (savedDoc.receiver_addr1) setReceiverAddr1(savedDoc.receiver_addr1);
      if (savedDoc.receiver_addr2) setReceiverAddr2(savedDoc.receiver_addr2);
      if (savedDoc.receiver_addr3) setReceiverAddr3(savedDoc.receiver_addr3);
    } else if (Array.isArray(rfqDetail.form?.quote_lines) && rfqDetail.form.quote_lines.length > 0) {
      const lines = rfqDetail.form.quote_lines.map((l: Row, idx: number) => {
        const qtyNum = Number(l.quantity) || 1;
        const price = Number(l.unit_price) || 0;
        const sub = Number((qtyNum * price).toFixed(2));
        const tax = Number((sub * (taxPercent / 100)).toFixed(2));
        return {
          id: String(idx + 1),
          description: l.description || `Transport Services - ${rfqDetail.mode ? rfqDetail.mode.toUpperCase() : "Freight"} (${rfqDetail.origin || "Origin"} to ${rfqDetail.destination || "Destination"})`,
          qty: `${qtyNum} ${l.unit || "Shipment"}`,
          unit_price: price,
          subtotal: sub,
          tax: tax,
        };
      });
      setItems(lines);
    } else {
      // Create initial line based on RFQ route & cargo
      const modeLabel = rfqDetail.mode ? rfqDetail.mode.toUpperCase() : "TRANSPORT";
      const route = rfqDetail.origin && rfqDetail.destination ? ` (${rfqDetail.origin} to ${rfqDetail.destination})` : "";
      const desc = `Transport Services - ${modeLabel} Freight${route}${rfqDetail.cargo ? ` · ${rfqDetail.cargo.slice(0, 80)}` : ""}`;
      setItems([
        {
          id: "1",
          description: desc,
          qty: "1 Shipment",
          unit_price: 0,
          subtotal: 0,
          tax: 0,
        },
      ]);
    }
  }, [rfqDetail.id]);

  // Recalculate financial totals
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);
  }, [items]);

  const taxTotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.tax) || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return subtotal + taxTotal;
  }, [subtotal, taxTotal]);

  // Missing fields detection
  const missingFields = useMemo(() => {
    const missing: { field: string; label: string; tabHint: "sender" | "receiver" | "quote" | "items" }[] = [];
    if (!senderName.trim()) missing.push({ field: "senderName", label: "Sender Name", tabHint: "sender" });
    if (!senderAddr1.trim()) missing.push({ field: "senderAddr1", label: "Sender Address", tabHint: "sender" });
    if (!senderPhone.trim() && !senderEmail.trim()) missing.push({ field: "senderContact", label: "Sender Phone or Email", tabHint: "sender" });
    if (!receiverName.trim()) missing.push({ field: "receiverName", label: "Receiver / Customer Name", tabHint: "receiver" });
    if (!receiverAddr1.trim()) missing.push({ field: "receiverAddr1", label: "Receiver Address", tabHint: "receiver" });
    if (!quoteNumber.trim()) missing.push({ field: "quoteNumber", label: "Quote Number", tabHint: "quote" });
    if (!validThrough.trim()) missing.push({ field: "validThrough", label: "Valid Through Date", tabHint: "quote" });
    if (items.length === 0) {
      missing.push({ field: "items", label: "Line Items (At least 1 required)", tabHint: "items" });
    } else {
      const hasUnpriced = items.some((i) => !i.description.trim() || Number(i.unit_price) === 0);
      if (hasUnpriced) {
        missing.push({ field: "unpriced", label: "Item Unit Price / Description", tabHint: "items" });
      }
    }
    return missing;
  }, [senderName, senderAddr1, senderPhone, senderEmail, receiverName, receiverAddr1, quoteNumber, validThrough, items]);

  const addItem = () => {
    const newId = String(items.length + 1);
    setItems([
      ...items,
      {
        id: newId,
        description: "Additional Transport Services",
        qty: "1 Unit",
        unit_price: 100,
        subtotal: 100,
        tax: Number((100 * (taxPercent / 100)).toFixed(2)),
      },
    ]);
  };

  const addDiscountItem = () => {
    const newId = String(items.length + 1);
    const discAmount = -50;
    const discTax = Number((discAmount * (taxPercent / 100)).toFixed(2));
    setItems([
      ...items,
      {
        id: newId,
        description: "Transport Services (Discount 10%)",
        qty: "1 Unit",
        unit_price: discAmount,
        subtotal: discAmount,
        tax: discTax,
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<QuoteLineItem>) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], ...patch };
      // If unit_price changed, update subtotal and tax automatically
      if ("unit_price" in patch && !("subtotal" in patch)) {
        // extract number from qty if possible
        const match = current.qty.match(/[-+]?\d*\.?\d+/);
        const qtyNum = match ? parseFloat(match[0]) : 1;
        current.subtotal = Number((qtyNum * (Number(patch.unit_price) || 0)).toFixed(2));
        current.tax = Number((current.subtotal * (taxPercent / 100)).toFixed(2));
      } else if ("subtotal" in patch && !("tax" in patch)) {
        current.tax = Number((Number(patch.subtotal) * (taxPercent / 100)).toFixed(2));
      }
      updated[index] = current;
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Print document
  const handlePrint = () => {
    window.print();
  };

  // Copy plain text summary
  const handleCopySummary = async () => {
    const linesText = items
      .map((i) => `• ${i.description}: ${i.qty} @ ${currencySymbol}${i.unit_price.toFixed(2)} = ${currencySymbol}${i.subtotal.toFixed(2)} (Tax: ${currencySymbol}${i.tax.toFixed(2)})`)
      .join("\n");
    const summary = `TRANSPORT PRICE QUOTE
Quote Number: ${quoteNumber}
Issue Date: ${issueDate}
Valid Through: ${validThrough}

SENDER:
${senderName}
${senderAddr1}${senderAddr2 ? `, ${senderAddr2}` : ""}${senderAddr3 ? `, ${senderAddr3}` : ""}
Phone: ${senderPhone || "N/A"} | Email: ${senderEmail || "N/A"}

RECEIVER:
${receiverName}
${receiverAddr1}${receiverAddr2 ? `, ${receiverAddr2}` : ""}${receiverAddr3 ? `, ${receiverAddr3}` : ""}

LINE ITEMS:
${linesText}

Subtotal: ${currencySymbol}${subtotal.toFixed(2)}
Tax (${taxPercent}%): ${currencySymbol}${taxTotal.toFixed(2)}
TOTAL: ${currencySymbol}${grandTotal.toFixed(2)}

TERMS & CONDITIONS:
${terms}`;

    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Quotation summary copied to clipboard");
    } catch {
      toast.error("Failed to copy quotation summary");
    }
  };

  // Save quotation document to RFQ
  const handleSaveToRfq = async () => {
    setBusy(true);
    setError(null);
    try {
      const quotationDoc = {
        quote_number: quoteNumber,
        issue_date: issueDate,
        valid_through: validThrough,
        sender_name: senderName,
        sender_addr1: senderAddr1,
        sender_addr2: senderAddr2,
        sender_addr3: senderAddr3,
        sender_phone: senderPhone,
        sender_email: senderEmail,
        receiver_name: receiverName,
        receiver_addr1: receiverAddr1,
        receiver_addr2: receiverAddr2,
        receiver_addr3: receiverAddr3,
        receiver_phone: receiverPhone,
        receiver_email: receiverEmail,
        items,
        subtotal,
        tax_total: taxTotal,
        tax_percent: taxPercent,
        grand_total: grandTotal,
        terms,
        updated_at: new Date().toISOString(),
      };

      // Also construct quote_lines for RFQ backend compatibility
      const chargeLines = items.map((item) => ({
        charge_type_id: rfqDetail.form?.quote_lines?.[0]?.charge_type_id || undefined,
        description: item.description,
        side: "sell",
        quantity: 1,
        unit: "shipment",
        unit_price: item.subtotal,
        currency: "USD",
        exchange_rate: 1,
      })).filter((c) => c.charge_type_id);

      const payload: Row = {
        status: rfqDetail.status === "new" ? "quoted" : rfqDetail.status,
        validity: validThrough ? new Date(validThrough + "T23:59:59Z").toISOString() : undefined,
        quotation_document: quotationDoc,
      };

      if (chargeLines.length > 0) {
        payload.quote_lines = chargeLines;
      }

      await freight.patch(`/rfqs/${rfqDetail.id}`, payload);
      toast.success("Quotation document saved to RFQ");
      if (onSaved) onSaved();
    } catch (err) {
      setError(err);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e3ef] pb-3 no-print">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${secondaryClass} ${activeTab === "document" ? "!bg-[#7068cf] !text-white" : ""}`}
            onClick={() => setActiveTab("document")}
          >
            <Eye className="h-3.5 w-3.5" />
            Document Preview
          </button>
          <button
            type="button"
            className={`${secondaryClass} ${activeTab === "editor" ? "!bg-[#7068cf] !text-white" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Inputs & Lines
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryClass}
            onClick={handleCopySummary}
            title="Copy text summary to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Text
          </button>
          <button
            type="button"
            className={secondaryClass}
            onClick={handlePrint}
            title="Print or export to PDF via browser print"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={handleSaveToRfq}
          >
            <Save className="h-3.5 w-3.5" />
            {busy ? "Saving…" : "Save to RFQ"}
          </button>
          {onClose && (
            <button type="button" className={secondaryClass} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      {/* Missing Inputs Alert Banner */}
      {missingFields.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm no-print">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <strong className="block text-sm font-semibold text-amber-950">
                Missing inputs required for complete quotation
              </strong>
              <p className="mt-1 text-amber-800">
                The following required information is missing from the RFQ or company settings. Please fill them below:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingFields.map((mf) => (
                  <button
                    key={mf.field}
                    type="button"
                    onClick={() => setActiveTab("editor")}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-2 py-0.5 font-medium text-amber-900 transition-colors hover:bg-amber-300"
                  >
                    <span>⚠️ {mf.label}</span>
                    <span className="text-[10px] text-amber-700 underline">fill &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW TAB */}
      {activeTab === "document" && (
        <div className="rounded-xl border border-[#e5e3ee] bg-slate-100 p-4 sm:p-8">
          {/* Printable A4 Container */}
          <div
            ref={printRef}
            id="transport-price-quote-doc"
            className="mx-auto max-w-3xl rounded bg-white p-8 shadow-md print:max-w-none print:p-0 print:shadow-none"
            style={{ minHeight: "1000px", fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}
          >
            {/* Header: Logo and Title */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="max-h-12 max-w-[180px] object-contain" />
                ) : (
                  <div className="flex items-center gap-2 font-bold tracking-tight text-slate-800">
                    <span className="inline-block rounded bg-[#0d7b5f] px-2 py-1 text-xs font-black text-white">FREIGHT</span>
                    <span className="text-sm uppercase tracking-wider">{senderName || "LOGISTICS & FORWARDING"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Header Bar */}
            <div className="mb-6 bg-[#6b7280] py-2.5 text-center text-white">
              <h1 className="text-xl font-bold uppercase tracking-wider">TRANSPORT PRICE QUOTE</h1>
            </div>

            {/* Sender and Receiver 2-Column Section */}
            <div className="mb-6 grid grid-cols-2 gap-8 text-xs leading-relaxed text-slate-700">
              {/* Sender Details */}
              <div>
                <h2 className="mb-2 font-bold uppercase tracking-wider text-[#475569]">SENDER</h2>
                <div className="space-y-1">
                  <p><span className="inline-block w-24 font-semibold text-slate-900">Name:</span> {senderName || <span className="text-amber-600 italic">[Company Name]</span>}</p>
                  <p><span className="inline-block w-24 font-semibold text-slate-900">Address:</span> {senderAddr1 || <span className="text-amber-600 italic">[Address Line 1]</span>}</p>
                  {senderAddr2 && <p><span className="inline-block w-24 font-semibold text-slate-900">Address:</span> {senderAddr2}</p>}
                  {senderAddr3 && <p><span className="inline-block w-24 font-semibold text-slate-900">Address:</span> {senderAddr3}</p>}
                  <p><span className="inline-block w-24 font-semibold text-slate-900">Phone Number:</span> {senderPhone || <span className="text-amber-600 italic">[Phone Number]</span>}</p>
                  <p><span className="inline-block w-24 font-semibold text-slate-900">Email:</span> {senderEmail || <span className="text-amber-600 italic">[Email Address]</span>}</p>
                </div>
              </div>

              {/* Receiver Details */}
              <div>
                <h2 className="mb-2 font-bold uppercase tracking-wider text-[#475569]">RECEIVER</h2>
                <div className="space-y-1">
                  <p><span className="inline-block w-20 font-semibold text-slate-900">Name:</span> {receiverName || <span className="text-amber-600 italic">[Company Name]</span>}</p>
                  <p><span className="inline-block w-20 font-semibold text-slate-900">Address:</span> {receiverAddr1 || <span className="text-amber-600 italic">[Address Line 1]</span>}</p>
                  {receiverAddr2 && <p><span className="inline-block w-20 font-semibold text-slate-900">Address:</span> {receiverAddr2}</p>}
                  {receiverAddr3 && <p><span className="inline-block w-20 font-semibold text-slate-900">Address:</span> {receiverAddr3}</p>}
                  {receiverPhone && <p><span className="inline-block w-20 font-semibold text-slate-900">Phone:</span> {receiverPhone}</p>}
                  {receiverEmail && <p><span className="inline-block w-20 font-semibold text-slate-900">Email:</span> {receiverEmail}</p>}
                </div>
              </div>
            </div>

            {/* Quote Meta Row */}
            <div className="mb-6 flex flex-wrap items-center justify-between border-y border-slate-200 py-2.5 text-xs text-slate-800">
              <div>
                <span className="font-semibold">Quote Number:</span>{" "}
                <span className="font-medium text-slate-900">{quoteNumber || <span className="text-amber-600 italic">[Quote Number]</span>}</span>
              </div>
              <div>
                <span className="font-semibold">Issue Date:</span>{" "}
                <span className="font-medium text-slate-900">{issueDate || <span className="text-amber-600 italic">[Issue Date]</span>}</span>
              </div>
              <div>
                <span className="font-semibold">Valid Through:</span>{" "}
                <span className="font-medium text-slate-900">{validThrough || <span className="text-amber-600 italic">[Valid Through]</span>}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-6 overflow-hidden rounded border border-slate-300">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#6b7280] text-[11px] font-bold uppercase tracking-wider text-white">
                    <th className="border-r border-slate-400 p-2 text-left">DESCRIPTION</th>
                    <th className="border-r border-slate-400 p-2 text-center" style={{ width: "15%" }}>QTY</th>
                    <th className="border-r border-slate-400 p-2 text-right" style={{ width: "15%" }}>UNIT PRICE</th>
                    <th className="border-r border-slate-400 p-2 text-right" style={{ width: "15%" }}>SUBTOTAL</th>
                    <th className="p-2 text-right" style={{ width: "15%" }}>TAX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="border-r border-slate-200 p-2.5 font-medium text-slate-900">{item.description}</td>
                      <td className="border-r border-slate-200 p-2.5 text-center text-slate-600">{item.qty}</td>
                      <td className="border-r border-slate-200 p-2.5 text-right font-mono">{Number(item.unit_price).toFixed(2)}</td>
                      <td className="border-r border-slate-200 p-2.5 text-right font-mono">{Number(item.subtotal).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono">{Number(item.tax).toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Empty rows filler for paper feel */}
                  {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
                    <tr key={`fill-${i}`} className="h-8">
                      <td className="border-r border-slate-200 p-2.5">&nbsp;</td>
                      <td className="border-r border-slate-200 p-2.5">&nbsp;</td>
                      <td className="border-r border-slate-200 p-2.5">&nbsp;</td>
                      <td className="border-r border-slate-200 p-2.5">&nbsp;</td>
                      <td className="p-2.5">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Box */}
            <div className="mb-8 flex justify-end">
              <div className="w-64 border border-slate-300 text-xs">
                <div className="flex justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="font-semibold text-slate-700">Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="font-semibold text-slate-700">Tax ({taxPercent}%)</span>
                  <span className="font-mono font-medium text-slate-900">{currencySymbol}{taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between bg-[#0d7b5f] px-3 py-2 text-white">
                  <span className="font-bold uppercase tracking-wider">Total</span>
                  <span className="font-mono font-bold text-white">{currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="text-xs text-slate-700">
              <h2 className="mb-2 font-bold uppercase tracking-wider text-[#475569]">Terms and Conditions</h2>
              <div className="whitespace-pre-line leading-relaxed text-slate-600">
                {terms}
              </div>
              {/* Ruled decorative lines matching document image */}
              <div className="mt-4 space-y-3">
                <div className="border-b border-slate-200"></div>
                <div className="border-b border-slate-200"></div>
                <div className="border-b border-slate-200"></div>
                <div className="border-b border-slate-200"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDITOR TAB */}
      {activeTab === "editor" && (
        <div className="space-y-6 rounded-xl border border-[#e5e3ee] bg-white p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* SENDER INPUTS */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-900">Sender Information (Your Company)</h3>
              <Field label="Company Name *">
                <input
                  type="text"
                  className={`${inputClass} ${!senderName.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Acme Freight Forwarding Ltd."
                />
              </Field>
              <Field label="Address Line 1 *">
                <input
                  type="text"
                  className={`${inputClass} ${!senderAddr1.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                  value={senderAddr1}
                  onChange={(e) => setSenderAddr1(e.target.value)}
                  placeholder="Street / Building"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Address Line 2 (City / State)">
                  <input
                    type="text"
                    className={inputClass}
                    value={senderAddr2}
                    onChange={(e) => setSenderAddr2(e.target.value)}
                    placeholder="City, State"
                  />
                </Field>
                <Field label="Address Line 3 (Country / Tax)">
                  <input
                    type="text"
                    className={inputClass}
                    value={senderAddr3}
                    onChange={(e) => setSenderAddr3(e.target.value)}
                    placeholder="Country or Tax ID"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone Number">
                  <input
                    type="text"
                    className={inputClass}
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="+1 555-0100"
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    className={inputClass}
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="quotes@company.com"
                  />
                </Field>
              </div>
            </div>

            {/* RECEIVER INPUTS */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-900">Receiver Information (Customer)</h3>
              <Field label="Customer / Company Name *">
                <input
                  type="text"
                  className={`${inputClass} ${!receiverName.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="e.g. Global Imports Corp."
                />
              </Field>
              <Field label="Address Line 1 *">
                <input
                  type="text"
                  className={`${inputClass} ${!receiverAddr1.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                  value={receiverAddr1}
                  onChange={(e) => setReceiverAddr1(e.target.value)}
                  placeholder="Customer Street / Building"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Address Line 2 (City / State)">
                  <input
                    type="text"
                    className={inputClass}
                    value={receiverAddr2}
                    onChange={(e) => setReceiverAddr2(e.target.value)}
                    placeholder="City, State"
                  />
                </Field>
                <Field label="Address Line 3 (Country / Postal)">
                  <input
                    type="text"
                    className={inputClass}
                    value={receiverAddr3}
                    onChange={(e) => setReceiverAddr3(e.target.value)}
                    placeholder="Country"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Customer Phone">
                  <input
                    type="text"
                    className={inputClass}
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="Customer Phone"
                  />
                </Field>
                <Field label="Customer Email">
                  <input
                    type="email"
                    className={inputClass}
                    value={receiverEmail}
                    onChange={(e) => setReceiverEmail(e.target.value)}
                    placeholder="buyer@customer.com"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* QUOTE METADATA */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-5">
            <Field label="Quote Number *">
              <input
                type="text"
                className={`${inputClass} ${!quoteNumber.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
              />
            </Field>
            <Field label="Issue Date *">
              <input
                type="date"
                className={inputClass}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </Field>
            <Field label="Valid Through *">
              <input
                type="date"
                className={`${inputClass} ${!validThrough.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                value={validThrough}
                onChange={(e) => setValidThrough(e.target.value)}
              />
            </Field>
            <Field label="Currency Symbol">
              <input
                type="text"
                className={inputClass}
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                maxLength={4}
              />
            </Field>
            <Field label="Tax Rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={inputClass}
                value={taxPercent}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setTaxPercent(val);
                  setItems((prev) =>
                    prev.map((item) => ({
                      ...item,
                      tax: Number((item.subtotal * (val / 100)).toFixed(2)),
                    }))
                  );
                }}
              />
            </Field>
          </div>

          {/* LINE ITEMS TABLE EDITOR */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Line Items Breakdown</h3>
              <div className="flex gap-2">
                <button type="button" className={secondaryClass} onClick={addDiscountItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Discount Row
                </button>
                <button type="button" className={buttonClass} onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Service Line
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-semibold text-slate-700">
                    <th className="p-3">Description *</th>
                    <th className="p-3" style={{ width: "130px" }}>Qty / Unit</th>
                    <th className="p-3" style={{ width: "130px" }}>Unit Price</th>
                    <th className="p-3" style={{ width: "130px" }}>Subtotal</th>
                    <th className="p-3" style={{ width: "110px" }}>Tax</th>
                    <th className="p-3 text-right" style={{ width: "60px" }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50">
                      <td className="p-2">
                        <input
                          type="text"
                          className={`${inputClass} ${!item.description.trim() ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="e.g. Transport Services or Discount"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className={inputClass}
                          value={item.qty}
                          onChange={(e) => updateItem(index, { qty: e.target.value })}
                          placeholder="5 Hours, 1 Cont"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono ${item.unit_price === 0 ? "border-amber-400 ring-2 ring-amber-100" : ""}`}
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono`}
                          value={item.subtotal}
                          onChange={(e) => updateItem(index, { subtotal: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono`}
                          value={item.tax}
                          onChange={(e) => updateItem(index, { tax: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:text-red-600"
                          onClick={() => removeItem(index)}
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No line items yet. Click &quot;Add Service Line&quot; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculated Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-72 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Subtotal:</span>
                  <span className="font-mono">{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Tax ({taxPercent}%):</span>
                  <span className="font-mono">{currencySymbol}{taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Amount:</span>
                  <span className="font-mono text-[#0d7b5f]">{currencySymbol}{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TERMS AND CONDITIONS EDITOR */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Terms and Conditions for this Quotation</h3>
              <button
                type="button"
                className="text-xs text-[#7068cf] underline hover:text-[#5a52b8]"
                onClick={() => setTerms(settings.quotation_terms_and_conditions || DEFAULT_TERMS)}
              >
                Reset to settings default
              </button>
            </div>
            <textarea
              rows={6}
              className={inputClass}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Enter quotation terms and conditions..."
            />
            <p className="text-[11px] text-slate-500">
              Tip: You can set the global default terms and conditions in Settings &gt; Quotation Defaults.
            </p>
          </div>
        </div>
      )}

      {/* Print-specific CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #transport-price-quote-doc, #transport-price-quote-doc * {
            visibility: visible !important;
          }
          #transport-price-quote-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
