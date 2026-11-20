"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Copy, Save, AlertCircle, Plus, Trash2, FileText, Edit3, Eye, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { freight, errorMessage, calculateConsignmentTotals, type Cargo, type ChargeType, type Page } from "@/lib/freight";
import { buttonClass, secondaryClass, inputClass, Field, ErrorBanner } from "./shared";
import { OutlookDraftButton } from "./outlook-draft-button";

type Row = Record<string, any>;

export type TransportPriceQuoteProps = {
  rfq: Row;
  onClose?: () => void;
  onSaved?: () => void;
  initialTab?: "document" | "pdf" | "editor";
};

export type QuoteChargeCategory = "" | "freight" | "export" | "import" | "other";

export type QuoteLineItem = {
  id: string;
  description: string;
  subtitle?: string;
  category?: QuoteChargeCategory;
  line_currency?: string;
  qty: string;
  unit_price: number;
  subtotal: number;
  tax: number;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SGD: "S$",
  SAR: "SAR ",
};

const DEFAULT_TERMS = `1. Quote validity is strictly subject to the stated Offer Expiry date and space/equipment availability at booking.
2. Rates are based on current carrier tariffs and itemized surcharges; subject to GRI / fuel adjustments with notice.
3. Excludes destination customs duties, statutory taxes, port storage, demurrage, and detention unless expressly itemized above.
4. Transport is undertaken subject to standard house bill / airwaybill conditions of carriage.
5. Payment terms: As agreed in company credit policy.`;

function formatQuoteDatePair(raw?: string): { long: string; short: string } {
  const cleaned = (raw || "").trim();
  if (!cleaned) return { long: "—", short: "—" };
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const dt = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    if (!Number.isNaN(dt.getTime())) {
      const long = dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
      const short = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
      return { long, short };
    }
  }
  return { long: cleaned, short: cleaned };
}

function inferChargeCategory(description: string, explicit?: string): "freight" | "export" | "import" | "other" {
  const cat = (explicit || "").trim().toLowerCase();
  if (cat === "freight" || cat === "export" || cat === "import" || cat === "other") return cat;
  const low = (description || "").toLowerCase();
  if (
    ["dest", "import", "delivery order", "de-stuff", "destuff", "breakbulk", "lift on", "gate fee", "equipment maintenance", "arrival", "boe", "pod"].some((k) =>
      low.includes(k),
    )
  ) {
    return "import";
  }
  if (["orig", "export", "pickup", "exw", "vgm", "cfs receiving", "stuffing", "screening", "x-ray", "booking"].some((k) => low.includes(k))) {
    return "export";
  }
  if (
    [
      "ocean freight",
      "sea freight",
      "air freight",
      "road freight",
      "rail freight",
      "trucking",
      "haulage",
      "lcl freight",
      "fcl freight",
      "transport services",
      "freight services",
      "main carriage",
      "fuel",
      "fsc",
      "baf",
      "mfr",
      "pss",
      "gri",
    ].some((k) => low.includes(k))
  ) {
    return "freight";
  }
  return "other";
}

export function TransportPriceQuoteModal({ rfq, onClose, onSaved, initialTab = "document" }: TransportPriceQuoteProps) {
  const [activeTab, setActiveTab] = useState<"document" | "pdf" | "editor">(initialTab);
  const [busy, setBusy] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [pdfFallbackNote, setPdfFallbackNote] = useState<string>("");
  const [error, setError] = useState<unknown>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const settingsQuery = useQuery<Row>({
    queryKey: ["freight", "settings"],
    queryFn: () => freight.get<Row>("/settings"),
  });

  const rfqQuery = useQuery<Row>({
    queryKey: ["freight", "rfq-detail", rfq.id],
    queryFn: () => freight.get<Row>("/rfqs/" + rfq.id),
  });

  const chargesQuery = useQuery<Page<ChargeType>>({
    queryKey: ["freight", "charge-schedule"],
    queryFn: () => freight.get<Page<ChargeType>>("/charge-schedule", { limit: 100 }),
  });

  const settings = settingsQuery.data || {};
  const rfqDetail = rfqQuery.data?.id ? rfqQuery.data : rfq;
  const chargeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of chargesQuery.data?.items || []) {
      map[c.id] = c.name;
    }
    return map;
  }, [chargesQuery.data]);

  // Sender details
  const [senderName, setSenderName] = useState("");
  const [senderAddr1, setSenderAddr1] = useState("");
  const [senderAddr2, setSenderAddr2] = useState("");
  const [senderAddr3, setSenderAddr3] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [preparedBy, setPreparedBy] = useState("");

  // Receiver details
  const [receiverName, setReceiverName] = useState("");
  const [attentionName, setAttentionName] = useState("");
  const [receiverAddr1, setReceiverAddr1] = useState("");
  const [receiverAddr2, setReceiverAddr2] = useState("");
  const [receiverAddr3, setReceiverAddr3] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");

  // Meta & Routing info (Hapag-Lloyd / Tier-1 Forwarder sidebar)
  const [quoteNumber, setQuoteNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validThrough, setValidThrough] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [taxPercent, setTaxPercent] = useState(0);
  const [serviceType, setServiceType] = useState("");
  const [commodityLabel, setCommodityLabel] = useState("");
  const [viaPort, setViaPort] = useState("");
  const [transitDays, setTransitDays] = useState("");
  const [freeTime, setFreeTime] = useState("");
  const [inclusionsNote, setInclusionsNote] = useState(
    "Rates reflect current carrier tariffs and itemized surcharges; subject to space & equipment availability at booking.",
  );
  const [subjectToNotes, setSubjectToNotes] = useState("");

  // Items & Terms
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [terms, setTerms] = useState("");

  const cargoItems: Cargo[] = useMemo(() => {
    const list = rfqDetail.form?.cargo_items;
    return Array.isArray(list) ? list : [];
  }, [rfqDetail.form?.cargo_items]);

  const cargoTotals = useMemo(() => calculateConsignmentTotals(cargoItems), [cargoItems]);

  useEffect(() => {
    if (settingsQuery.data) {
      setSenderName((prev) => prev || settings.name || "Freight Forwarding Co.");
      setSenderAddr1((prev) => prev || settings.address || "");
      setSenderAddr2((prev) => prev || settings.city || "");
      setSenderAddr3((prev) => prev || (settings.tax_number ? `Tax ID: ${settings.tax_number}` : ""));
      setSenderPhone((prev) => prev || settings.phone || "");
      setSenderEmail((prev) => prev || settings.email || "");
      setPreparedBy((prev) => prev || settings.contact_person || "");
      if (!terms) {
        setTerms(settings.quotation_terms_and_conditions || DEFAULT_TERMS);
      }
      if (!rfqDetail.form?.quotation_document && settings.default_quote_tax_percent !== undefined) {
        setTaxPercent(Number(settings.default_quote_tax_percent) || 0);
      }
      if (!rfqDetail.form?.quotation_document && settings.default_quote_currency) {
        const defCur = rfqDetail.form?.quote_currency || settings.default_quote_currency;
        setCurrency(defCur);
        setCurrencySymbol(CURRENCY_SYMBOLS[defCur] || `${defCur} `);
      }
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setIssueDate(today);
    setValidFrom(today);
    setQuoteNumber(rfqDetail.reference || `QT-${Date.now().toString().slice(-6)}`);

    if (rfqDetail.validity) {
      try {
        setValidThrough(new Date(rfqDetail.validity).toISOString().split("T")[0]);
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + (Number(settings.default_quote_validity_days) || 14));
        setValidThrough(d.toISOString().split("T")[0]);
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + (Number(settings.default_quote_validity_days) || 14));
      setValidThrough(d.toISOString().split("T")[0]);
    }

    const cust = (rfqDetail.customer || {}) as Row;
    const recName = cust.name || rfqDetail.customer_name || "";
    setReceiverName(recName);
    setAttentionName(cust.contact_name || recName || "Valued Partner");
    setReceiverAddr1(cust.address || "");
    setReceiverAddr2(cust.city || "");
    setReceiverAddr3(cust.country || "");
    setReceiverPhone(cust.phone || "");
    setReceiverEmail(cust.email || "");

    const modeUpper = (rfqDetail.mode || "freight").toUpperCase();
    const incoterm = rfqDetail.form?.incoterm || "";
    setServiceType(incoterm ? `${modeUpper} · ${incoterm}` : `${modeUpper} SERVICE`);

    const firstCargo = cargoItems[0];
    const defaultComm = firstCargo?.description || rfqDetail.cargo || "FAK / General Cargo";
    setCommodityLabel(
      firstCargo?.commodity_number && !defaultComm.includes(firstCargo.commodity_number)
        ? `${defaultComm} (HS ${firstCargo.commodity_number})`
        : String(defaultComm).slice(0, 70),
    );

    const savedDoc = rfqDetail.form?.quotation_document;
    const effectiveTax =
      savedDoc?.tax_percent !== undefined
        ? Number(savedDoc.tax_percent)
        : rfqDetail.form?.tax_percent !== undefined
          ? Number(rfqDetail.form.tax_percent)
          : Number(settings.default_quote_tax_percent ?? 0);

    if (savedDoc && Array.isArray(savedDoc.items) && savedDoc.items.length > 0) {
      setItems(savedDoc.items);
      if (savedDoc.terms) setTerms(savedDoc.terms);
      if (savedDoc.quote_number) setQuoteNumber(savedDoc.quote_number);
      if (savedDoc.valid_from) setValidFrom(savedDoc.valid_from);
      if (savedDoc.currency) {
        setCurrency(savedDoc.currency);
        setCurrencySymbol(savedDoc.currency_symbol || CURRENCY_SYMBOLS[savedDoc.currency] || `${savedDoc.currency} `);
      }
      if (savedDoc.tax_percent !== undefined) setTaxPercent(Number(savedDoc.tax_percent));
      if (savedDoc.sender_name) setSenderName(savedDoc.sender_name);
      if (savedDoc.sender_addr1) setSenderAddr1(savedDoc.sender_addr1);
      if (savedDoc.sender_addr2) setSenderAddr2(savedDoc.sender_addr2);
      if (savedDoc.sender_addr3) setSenderAddr3(savedDoc.sender_addr3);
      if (savedDoc.sender_phone) setSenderPhone(savedDoc.sender_phone);
      if (savedDoc.sender_email) setSenderEmail(savedDoc.sender_email);
      if (savedDoc.prepared_by) setPreparedBy(savedDoc.prepared_by);
      if (savedDoc.receiver_name) setReceiverName(savedDoc.receiver_name);
      if (savedDoc.attention_name) setAttentionName(savedDoc.attention_name);
      if (savedDoc.receiver_addr1) setReceiverAddr1(savedDoc.receiver_addr1);
      if (savedDoc.receiver_addr2) setReceiverAddr2(savedDoc.receiver_addr2);
      if (savedDoc.receiver_addr3) setReceiverAddr3(savedDoc.receiver_addr3);
      if (savedDoc.service_type) setServiceType(savedDoc.service_type);
      if (savedDoc.commodity_label) setCommodityLabel(savedDoc.commodity_label);
      if (savedDoc.via_port !== undefined) setViaPort(savedDoc.via_port);
      if (savedDoc.transit_days !== undefined) setTransitDays(savedDoc.transit_days);
      if (savedDoc.free_time !== undefined) setFreeTime(savedDoc.free_time);
      if (savedDoc.inclusions_note !== undefined) setInclusionsNote(savedDoc.inclusions_note);
      if (savedDoc.subject_to_notes !== undefined) setSubjectToNotes(savedDoc.subject_to_notes);
    } else if (Array.isArray(rfqDetail.form?.quote_lines) && rfqDetail.form.quote_lines.length > 0) {
      const firstCurrency = rfqDetail.form.quote_lines[0]?.currency || "USD";
      setCurrency(firstCurrency);
      setCurrencySymbol(CURRENCY_SYMBOLS[firstCurrency] || `${firstCurrency} `);
      setTaxPercent(effectiveTax);
      const lines: QuoteLineItem[] = rfqDetail.form.quote_lines.map((l: Row, idx: number) => {
        const qtyNum = Number(l.quantity) || 1;
        const unitPrice = Number(l.unit_price) || 0;
        const sub = Number((qtyNum * unitPrice).toFixed(2));
        const tax = Number((sub * (effectiveTax / 100)).toFixed(2));
        const cName = l.description || chargeNames[l.charge_type_id] || `Freight Services (${rfqDetail.origin || "Origin"} → ${rfqDetail.destination || "Destination"})`;
        return {
          id: String(idx + 1),
          description: cName,
          line_currency: l.currency || firstCurrency,
          qty: `${qtyNum} ${l.unit || "shipment"}`,
          unit_price: unitPrice,
          subtotal: sub,
          tax,
        };
      });
      setItems(lines);
    } else {
      const modeLabel = rfqDetail.mode ? rfqDetail.mode.toUpperCase() : "TRANSPORT";
      const route = rfqDetail.origin && rfqDetail.destination ? ` (${rfqDetail.origin} → ${rfqDetail.destination})` : "";
      const desc = `${modeLabel} Freight${route}${rfqDetail.cargo ? ` · ${rfqDetail.cargo.slice(0, 80)}` : ""}`;
      const initialItems: QuoteLineItem[] = [
        {
          id: "1",
          description: desc,
          category: "freight",
          line_currency: currency,
          qty: "1 Shipment",
          unit_price: 0,
          subtotal: 0,
          tax: 0,
        },
      ];
      const docFee = Number(rfqDetail.form?.documentation_fee ?? settings.default_documentation_fee ?? 0);
      if (docFee > 0) {
        initialItems.push({
          id: "2",
          description: "Export Documentation & B/L / AWB Fee",
          category: "export",
          line_currency: currency,
          qty: "1 Doc",
          unit_price: docFee,
          subtotal: docFee,
          tax: Number((docFee * (effectiveTax / 100)).toFixed(2)),
        });
      }
      setItems(initialItems);
    }
  }, [rfqDetail.id, Object.keys(chargeNames).length]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0), [items]);
  const taxTotal = useMemo(() => items.reduce((acc, item) => acc + (Number(item.tax) || 0), 0), [items]);
  const grandTotal = useMemo(() => subtotal + taxTotal, [subtotal, taxTotal]);

  const groupedCharges = useMemo(() => {
    const groups: Record<"freight" | "export" | "import" | "other", QuoteLineItem[]> = {
      freight: [],
      export: [],
      import: [],
      other: [],
    };
    for (const item of items) {
      const sec = inferChargeCategory(item.description, item.category);
      groups[sec].push(item);
    }
    return groups;
  }, [items]);

  const currencyBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      const cur = (item.line_currency || currency || "USD").toUpperCase();
      map[cur] = (map[cur] || 0) + (Number(item.subtotal) || 0) + (Number(item.tax) || 0);
    }
    return Object.entries(map);
  }, [items, currency]);

  const buildQuotationPayload = () => ({
    quote_number: quoteNumber,
    issue_date: issueDate,
    valid_from: validFrom || issueDate,
    valid_through: validThrough,
    currency,
    currency_symbol: currencySymbol,
    tax_percent: taxPercent,
    sender_name: senderName,
    sender_addr1: senderAddr1,
    sender_addr2: senderAddr2,
    sender_addr3: senderAddr3,
    sender_phone: senderPhone,
    sender_email: senderEmail,
    prepared_by: preparedBy,
    receiver_name: receiverName,
    attention_name: attentionName,
    receiver_addr1: receiverAddr1,
    receiver_addr2: receiverAddr2,
    receiver_addr3: receiverAddr3,
    receiver_phone: receiverPhone,
    receiver_email: receiverEmail,
    service_type: serviceType,
    commodity_label: commodityLabel,
    via_port: viaPort,
    transit_days: transitDays,
    free_time: freeTime,
    inclusions_note: inclusionsNote,
    subject_to_notes: subjectToNotes,
    items,
    cargo_items: cargoItems,
    terms,
  });

  const loadPdfPreview = async () => {
    setPdfLoading(true);
    setPdfFallbackNote("");
    setError(null);
    const payload = buildQuotationPayload();
    try {
      const response = await api.post(`/freight/rfqs/${rfqDetail.id}/quote-pdf`, payload, {
        responseType: "blob",
      });
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "application/pdf" });
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(URL.createObjectURL(blob));
      setPreviewHtml("");
    } catch {
      try {
        const htmlRes = await api.post(`/freight/rfqs/${rfqDetail.id}/quote-preview`, payload, {
          responseType: "text",
        });
        setPreviewHtml(typeof htmlRes.data === "string" ? htmlRes.data : "");
        setPdfFallbackNote("Showing server A4 Quotation Document preview (WeasyPrint native PDF library unavailable on this host). Use Print / Save as PDF to export.");
      } catch {
        setPdfFallbackNote("Showing local Quotation Document preview. Use Print / Save as PDF to export.");
        setPreviewHtml("");
      }
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pdf") {
      void loadPdfPreview();
    }
  }, [activeTab]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const response = await api.post(
        `/freight/rfqs/${rfqDetail.id}/quote-pdf?download=true`,
        buildQuotationPayload(),
        { responseType: "blob" },
      );
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote-${quoteNumber || rfqDetail.reference}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.info("PDF generator unavailable on this host — opening browser print dialog (Save as PDF).");
      window.print();
    } finally {
      setPdfLoading(false);
    }
  };

  const missingFields = useMemo(() => {
    const missing: { field: string; label: string }[] = [];
    if (!senderName.trim()) missing.push({ field: "senderName", label: "Sender Name" });
    if (!senderAddr1.trim()) missing.push({ field: "senderAddr1", label: "Sender Address" });
    if (!senderPhone.trim() && !senderEmail.trim()) missing.push({ field: "senderContact", label: "Sender Phone or Email" });
    if (!receiverName.trim()) missing.push({ field: "receiverName", label: "Receiver / Customer Name" });
    if (!receiverAddr1.trim()) missing.push({ field: "receiverAddr1", label: "Receiver Address" });
    if (!quoteNumber.trim()) missing.push({ field: "quoteNumber", label: "Quotation Number" });
    if (!validThrough.trim()) missing.push({ field: "validThrough", label: "Offer Expiry Date" });
    if (items.length === 0) {
      missing.push({ field: "items", label: "Line Items (At least 1 required)" });
    } else if (items.some((i) => !i.description.trim() || Number(i.unit_price) === 0)) {
      missing.push({ field: "unpriced", label: "Item Rate / Description" });
    }
    return missing;
  }, [senderName, senderAddr1, senderPhone, senderEmail, receiverName, receiverAddr1, quoteNumber, validThrough, items]);

  const addItem = (category: QuoteChargeCategory = "") => {
    const newId = String(items.length + 1);
    const defaultLabel =
      category === "export"
        ? "Origin Terminal Handling Charge (THC)"
        : category === "import"
          ? "Destination Delivery Order & Handling"
          : "Ocean / Air Freight Charge";
    setItems([
      ...items,
      {
        id: newId,
        description: defaultLabel,
        category,
        line_currency: currency,
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
        description: "Commercial Freight Rebate / Discount",
        category: "other",
        line_currency: currency,
        qty: "1 Shpt",
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
      if (("unit_price" in patch || "qty" in patch) && !("subtotal" in patch)) {
        const match = current.qty.match(/[-+]?\d*\.?\d+/);
        const qtyNum = match ? parseFloat(match[0]) : 1;
        current.subtotal = Number((qtyNum * (Number(current.unit_price) || 0)).toFixed(2));
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

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    const linesText = items
      .map(
        (i) =>
          `• ${i.description}: ${i.qty} @ ${i.line_currency || currency} ${i.unit_price.toFixed(2)} = ${i.line_currency || currency} ${i.subtotal.toFixed(2)}`,
      )
      .join("\n");
    const summary = `QUOTATION DOCUMENT — ${quoteNumber}
Issued: ${issueDate} | Valid From: ${validFrom || issueDate} | Valid Through: ${validThrough}
Route: ${rfqDetail.origin || "Origin"} → ${rfqDetail.destination || "Destination"}${viaPort ? ` (via ${viaPort})` : ""}

PREPARED FOR:
${receiverName} (Attn: ${attentionName || receiverName})
${receiverAddr1}${receiverAddr2 ? `, ${receiverAddr2}` : ""}${receiverAddr3 ? `, ${receiverAddr3}` : ""}

ISSUED BY:
${senderName}
${senderAddr1}${senderAddr2 ? `, ${senderAddr2}` : ""}${senderAddr3 ? `, ${senderAddr3}` : ""}
Tel: ${senderPhone || "N/A"} | Email: ${senderEmail || "N/A"}

OFFER BREAKDOWN:
${linesText}

Net Subtotal: ${currencySymbol}${subtotal.toFixed(2)}
Tax (${taxPercent}%): ${currencySymbol}${taxTotal.toFixed(2)}
TOTAL OFFER (${currency}): ${currencySymbol}${grandTotal.toFixed(2)}

TERMS & CONDITIONS:
${terms}`;

    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Quotation summary copied to clipboard");
    } catch {
      toast.error("Failed to copy quotation summary");
    }
  };

  const handleSaveToRfq = async () => {
    setBusy(true);
    setError(null);
    try {
      const quotationDoc = {
        ...buildQuotationPayload(),
        subtotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        updated_at: new Date().toISOString(),
      };

      const defaultChargeId = rfqDetail.form?.quote_lines?.[0]?.charge_type_id || chargesQuery.data?.items?.[0]?.id;
      const cleanCurrency = (currency || "USD").trim().toUpperCase();
      const savedFx = Number(rfqDetail.form?.quote_lines?.[0]?.exchange_rate) || 0;
      const fxRate = cleanCurrency === "USD" ? 1 : savedFx > 0 ? savedFx : 0;
      const rawPositive = items.map((item) => Number(item.subtotal) || 0).filter((amt) => amt > 0);
      const totalDiscount = items
        .map((item) => Number(item.subtotal) || 0)
        .filter((amt) => amt < 0)
        .reduce((acc, v) => acc + Math.abs(v), 0);
      const positiveSum = rawPositive.reduce((acc, v) => acc + v, 0);

      const chargeLines =
        defaultChargeId && fxRate > 0 && positiveSum > 0
          ? items
              .filter((item) => (Number(item.subtotal) || 0) > 0)
              .map((item) => {
                const rawSub = Number(item.subtotal) || 0;
                const shareOfDiscount = totalDiscount > 0 && positiveSum > 0 ? Math.min(rawSub, (rawSub / positiveSum) * totalDiscount) : 0;
                return {
                  charge_type_id: defaultChargeId,
                  side: "sell",
                  quantity: 1,
                  unit: "shipment",
                  unit_price: Number(Math.max(0, rawSub - shareOfDiscount).toFixed(2)),
                  currency: cleanCurrency,
                  exchange_rate: fxRate,
                };
              })
          : [];

      const payload: Row = {
        status: chargeLines.length > 0 && validThrough ? "quoted" : ["new", "quote_draft"].includes(rfqDetail.status) ? "quote_draft" : rfqDetail.status,
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

  const issueDates = formatQuoteDatePair(issueDate);
  const validFromDates = formatQuoteDatePair(validFrom || issueDate);
  const validToDates = formatQuoteDatePair(validThrough);
  const locTypeLabel = (rfqDetail.mode || "").toLowerCase() === "air" ? "AIRPORT" : ["road", "rail"].includes((rfqDetail.mode || "").toLowerCase()) ? "LOCATION" : "PORT";
  const hasSurcharges = groupedCharges.export.length > 0 || groupedCharges.import.length > 0 || groupedCharges.other.length > 0;

  const renderSectionTable = (headerLabel: string, sectionRows: QuoteLineItem[]) => (
    <table className="mb-3 w-full border-collapse text-left text-[11px]">
      <thead>
        <tr className="border-y border-slate-300 bg-[#e9eef5] text-[10.5px] font-bold text-slate-900">
          <th className="px-2 py-1.5" style={{ width: "45%" }}>{headerLabel}</th>
          <th className="px-2 py-1.5 text-center" style={{ width: "10%" }}>Curr.</th>
          <th className="px-2 py-1.5 text-center" style={{ width: "15%" }}>Basis / Qty</th>
          <th className="px-2 py-1.5 text-right" style={{ width: "15%" }}>Rate</th>
          <th className="px-2 py-1.5 text-right" style={{ width: "15%" }}>Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 text-slate-800">
        {sectionRows.map((row, idx) => {
          const lineCur = (row.line_currency || currency || "USD").toUpperCase();
          return (
            <tr key={row.id || idx}>
              <td className="px-2 py-1.5 align-top">
                <div className="font-medium text-slate-900">{row.description}</div>
                {row.subtitle && <div className="mt-0.5 text-[10px] font-semibold text-slate-600">{row.subtitle}</div>}
              </td>
              <td className="px-2 py-1.5 text-center align-top font-semibold text-slate-700">{lineCur}</td>
              <td className="px-2 py-1.5 text-center align-top text-slate-600">{row.qty}</td>
              <td className="px-2 py-1.5 text-right align-top font-mono">{Number(row.unit_price).toFixed(2)}</td>
              <td className="px-2 py-1.5 text-right align-top font-mono">
                <span className="font-bold text-slate-900">{Number(row.subtotal).toFixed(2)}</span>
                {Number(row.tax) !== 0 && (
                  <div className="text-[9.5px] text-slate-500">Tax: {Number(row.tax).toFixed(2)}</div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e3ef] pb-3">
        <div className="flex flex-wrap items-center gap-2">
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
            className={`${secondaryClass} ${activeTab === "pdf" ? "!bg-[#7068cf] !text-white" : ""}`}
            onClick={() => setActiveTab("pdf")}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF Preview
          </button>
          <button
            type="button"
            className={`${secondaryClass} ${activeTab === "editor" ? "!bg-[#7068cf] !text-white" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Inputs &amp; Lines
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryClass} onClick={handleCopySummary}>
            <Copy className="h-3.5 w-3.5" />
            Copy Text
          </button>
          <button type="button" className={secondaryClass} onClick={handleDownloadPdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PDF
          </button>
          <button type="button" className={secondaryClass} onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          {rfqDetail?.id && (
            <OutlookDraftButton
              rfqId={rfqDetail.id}
              attachRfqQuotePdf
              variant="secondary"
              label="Outlook Draft + PDF"
              body={`Dear ${attentionName || receiverName || "Customer"},\n\nThank you for your recent enquiry. Please find attached our Quotation Document ${quoteNumber} for ${rfqDetail.origin || "Origin"} → ${rfqDetail.destination || "Destination"} (${currencySymbol}${grandTotal.toFixed(2)} ${currency}, valid through ${validToDates.long}).\n\nPlease confirm your booking prior to the offer expiry date.\n\nBest regards,\n${preparedBy ? `${preparedBy}\n` : ""}${senderName}`}
            />
          )}
          <button type="button" className={buttonClass} disabled={busy} onClick={handleSaveToRfq}>
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

      {missingFields.length > 0 && (
        <div className="no-print rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <strong className="block text-sm font-semibold text-amber-950">
                Missing inputs required for complete quotation
              </strong>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingFields.map((mf) => (
                  <button
                    key={mf.field}
                    type="button"
                    onClick={() => setActiveTab("editor")}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-300"
                  >
                    <span>{mf.label}</span>
                    <span className="text-[10px] text-amber-700 underline">fill →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pdf" && (
        <div className="space-y-3 rounded-xl border border-[#e5e3ee] bg-slate-100 p-4">
          {pdfLoading ? (
            <div className="flex h-[520px] items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-[#7068cf]" />
              Generating Quotation PDF preview…
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title="Quotation PDF Preview"
              className="h-[780px] w-full rounded border border-slate-300 bg-white"
            />
          ) : previewHtml ? (
            <>
              {pdfFallbackNote && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  {pdfFallbackNote}
                </div>
              )}
              <iframe
                srcDoc={previewHtml}
                sandbox=""
                title="Quotation A4 Preview"
                className="h-[780px] w-full rounded border border-slate-300 bg-white"
              />
            </>
          ) : (
            <div className="space-y-3">
              {pdfFallbackNote && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  {pdfFallbackNote}
                </div>
              )}
              <div className="text-center text-xs text-slate-600">
                Switch to Document Preview or click Print to save as PDF.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "document" && (
        <div className="rounded-xl border border-[#e5e3ee] bg-slate-100 p-4 sm:p-8">
          <div
            ref={printRef}
            id="transport-price-quote-doc"
            className="mx-auto max-w-[850px] rounded bg-white p-7 sm:p-9 shadow-md print:max-w-none print:p-0 print:shadow-none text-slate-800"
            style={{ minHeight: "1020px", fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Arial, sans-serif" }}
          >
            {/* Top Header Row: Title + Receiver on Left | Brand Logo + Date on Right */}
            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="sm:w-[69%]">
                <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-950">Quotation Document</h1>
                <div className="text-[11px] leading-snug text-slate-900">
                  <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Prepared For (Receiver)</div>
                  <div className="text-xs font-bold uppercase text-slate-950">
                    {receiverName || <span className="italic text-amber-600">[Customer Company Name]</span>}
                  </div>
                  <div>{receiverAddr1 || <span className="italic text-amber-600">[Customer Address]</span>}</div>
                  {(receiverAddr2 || receiverAddr3) && (
                    <div>{[receiverAddr2, receiverAddr3].filter(Boolean).join(", ")}</div>
                  )}
                  {(receiverPhone || receiverEmail) && (
                    <div className="mt-0.5 text-slate-600">
                      {[receiverPhone ? `Tel: ${receiverPhone}` : "", receiverEmail].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:w-[28.5%] sm:text-right">
                {settings.logo_url ? (
                  <div className="ml-auto flex h-[52px] w-[190px] items-center justify-end">
                    <img
                      src={settings.logo_url}
                      alt={`${senderName || "Company"} Logo`}
                      className="max-h-[50px] max-w-[190px] object-contain"
                    />
                  </div>
                ) : (
                  <a
                    href="/settings"
                    title="Upload your company logo in Settings → Company Profile"
                    className="ml-auto flex h-[52px] w-[190px] flex-col items-center justify-center rounded border border-dashed border-slate-400 bg-slate-50 px-2 text-center transition hover:border-[#7068cf] hover:bg-[#f6f5ff]"
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                      Company Logo
                    </span>
                    <span className="no-print text-[9px] font-medium text-[#7068cf]">
                      Upload in Settings &rarr;
                    </span>
                  </a>
                )}
                <div className="mt-1.5 text-xs text-slate-700">{issueDates.long}</div>
              </div>
            </div>

            {/* Asymmetric Two-Column Body: Left Offer & Categorized Tables | Right Gray Sidebar */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
              {/* Left Main Column (~69%) */}
              <div className="min-w-0 flex-1 sm:basis-[69%]">
                <p className="mb-2 text-xs text-slate-900">
                  Dear {attentionName || receiverName || "Valued Partner"},
                </p>
                <p className="mb-3 text-[11.5px] leading-relaxed text-slate-700">
                  Thank you for your recent enquiry. <strong className="font-semibold text-slate-900">{senderName || "Our team"}</strong> is pleased to make you the following offer, for which please find our rates and shipment details below.
                </p>

                <div className="mb-5 border-l-[3px] border-[#1e3a8a] bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                  <p>
                    Offer expires on: <strong className="font-bold text-slate-950">{validToDates.long}</strong>
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-slate-600">
                    Our quotation is valid until the above mentioned offer expiry date. We reserve the right to review and re-quote if we do not receive any booking prior to the above mentioned offer expiry date.
                  </p>
                </div>

                {/* Categorized Charge Tables (Hapag-Lloyd Horizontal-Rule Style) */}
                {items.length === 0 ? (
                  <div className="mb-5 rounded border border-slate-200 p-4 text-center text-xs text-slate-500">
                    No charge lines added yet — open <strong>Edit Inputs &amp; Lines</strong> to add rates.
                  </div>
                ) : (
                  <>
                    {groupedCharges.freight.length > 0 && (
                      <div className="mb-5">
                        <h2 className="mb-1.5 text-sm font-bold text-slate-950">Freight Charges</h2>
                        {renderSectionTable("Freight Charges", groupedCharges.freight)}
                        {inclusionsNote && (
                          <p className="text-[10px] leading-relaxed text-slate-600">{inclusionsNote}</p>
                        )}
                      </div>
                    )}

                    {hasSurcharges && (
                      <div className="mb-5">
                        <h2 className="mb-1 text-sm font-bold text-slate-950">Surcharges &amp; Local Charges</h2>
                        <p className="mb-2 text-[10.5px] text-slate-600">
                          Unless otherwise specified, all rates are subject to applicable surcharges valid at time of shipment. The currently itemized charges are:
                        </p>
                        {groupedCharges.export.length > 0 && renderSectionTable("Export / Origin Surcharges", groupedCharges.export)}
                        {groupedCharges.import.length > 0 && renderSectionTable("Import / Destination Surcharges", groupedCharges.import)}
                        {groupedCharges.other.length > 0 &&
                          renderSectionTable(
                            groupedCharges.freight.length === 0 && groupedCharges.export.length === 0 && groupedCharges.import.length === 0
                              ? "Freight & Service Charges"
                              : "Documentation & Additional Charges",
                            groupedCharges.other,
                          )}
                      </div>
                    )}
                  </>
                )}

                {/* Cargo & Chargeable Weight Schedule */}
                {cargoItems.length > 0 && (
                  <div className="mb-5">
                    <h2 className="mb-1.5 text-sm font-bold text-slate-950">Cargo &amp; Chargeable Weight Schedule</h2>
                    <table className="w-full border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-y border-slate-300 bg-[#e9eef5] text-[10.5px] font-bold text-slate-900">
                          <th className="px-2 py-1.5">Commodity &amp; Packing</th>
                          <th className="px-2 py-1.5 text-center">Pcs</th>
                          <th className="px-2 py-1.5 text-right">Gross Wt</th>
                          <th className="px-2 py-1.5 text-right">Vol (m³)</th>
                          <th className="px-2 py-1.5 text-right">Chargeable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {cargoItems.map((c, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1.5">
                              <span className="font-semibold text-slate-900">
                                {idx + 1}. {c.description || "General Cargo"}
                              </span>
                              {c.commodity_number && (
                                <span className="ml-1 text-[10px] text-slate-500">(HS {c.commodity_number})</span>
                              )}
                              {c.dimensions && <div className="text-[10px] text-slate-600">{c.dimensions}</div>}
                            </td>
                            <td className="px-2 py-1.5 text-center">{c.pieces || 0}</td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {Number(c.gross_weight || 0).toFixed(2)} {c.weight_unit || "kg"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">{Number(c.volume || 0).toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-900">
                              {Number(c.chargeable_weight || 0).toFixed(2)} kg
                            </td>
                          </tr>
                        ))}
                        <tr className="border-y-2 border-slate-400 bg-slate-50 font-semibold text-slate-950">
                          <td className="px-2 py-1.5">Consignment Totals</td>
                          <td className="px-2 py-1.5 text-center">{cargoTotals.totalPieces}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{cargoTotals.totalGrossKg.toFixed(2)} kg</td>
                          <td className="px-2 py-1.5 text-right font-mono">{cargoTotals.totalVolumeCbm.toFixed(3)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {Number(rfqDetail.form?.total_chargeable_weight || cargoTotals.autoChargeableWeightKg).toFixed(2)} kg
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Clean Totals Strip */}
                <div className="mb-5 flex flex-col items-end">
                  <div className="w-64 border-t-[1.5px] border-b-2 border-slate-900 bg-slate-50 text-xs">
                    <div className="flex justify-between border-b border-slate-200 px-2.5 py-1.5">
                      <span className="text-slate-700">Net Offer Subtotal ({currency})</span>
                      <span className="font-mono font-medium text-slate-900">{currencySymbol}{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 px-2.5 py-1.5">
                      <span className="text-slate-700">Applicable Tax ({taxPercent}%)</span>
                      <span className="font-mono font-medium text-slate-900">{currencySymbol}{taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-[#eef2f7] px-2.5 py-2 font-bold text-[#1e3a8a]">
                      <span>Total Offer ({currency})</span>
                      <span className="font-mono">{currencySymbol}{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  {currencyBreakdown.length > 1 && (
                    <div className="mt-1.5 text-[10.5px] text-slate-600">
                      Totals by Currency:{" "}
                      {currencyBreakdown.map(([cur, amt], i) => (
                        <span key={cur} className="font-semibold text-slate-800">
                          {i > 0 ? " · " : ""}
                          {cur} {amt.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes, Bank Details & Terms */}
                {subjectToNotes && (
                  <div className="mb-3 border-t border-slate-200 pt-2.5 text-[10.5px] text-slate-700">
                    <h3 className="mb-1 font-bold text-slate-950">Notes &amp; Subject-To Charges</h3>
                    <div className="whitespace-pre-line leading-relaxed">{subjectToNotes}</div>
                  </div>
                )}

                {settings.bank_details && (
                  <div className="mb-3 border-t border-slate-200 pt-2.5 text-[10.5px] text-slate-700">
                    <h3 className="mb-1 font-bold text-slate-950">Bank &amp; Remittance Details</h3>
                    <div className="whitespace-pre-line leading-relaxed text-slate-600">{settings.bank_details}</div>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-2.5 text-[10.5px] text-slate-700">
                  <h3 className="mb-1 font-bold text-slate-950">Terms &amp; Conditions</h3>
                  <div className="whitespace-pre-line leading-relaxed text-slate-600">{terms}</div>
                </div>
              </div>

              {/* Right Soft-Gray Summary Sidebar (~28.5%) */}
              <div className="flex flex-col justify-between rounded-sm bg-[#f3f4f6] p-4 text-xs sm:basis-[28.5%]">
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-600">Quotation number</div>
                    <div className="break-all text-base font-extrabold tracking-tight text-[#1e3a8a]">{quoteNumber}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-600">Service &amp; Terms</div>
                    <div className="font-bold text-slate-950">{serviceType || "FREIGHT SERVICE"}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-600">Commodity</div>
                    <div className="font-bold text-slate-950">{commodityLabel || "FAK / General Cargo"}</div>
                    {cargoItems.length > 0 && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                        {cargoTotals.totalPieces} Pcs · {cargoTotals.totalGrossKg.toFixed(1)} kg · {cargoTotals.totalVolumeCbm.toFixed(3)} m³
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-slate-600">Valid from</div>
                      <div className="font-bold text-slate-950">{validFromDates.short}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-600">Valid to</div>
                      <div className="font-bold text-slate-950">{validToDates.short}</div>
                    </div>
                  </div>

                  <hr className="border-slate-300" />

                  <div>
                    <div className="text-[10px] text-slate-600">From</div>
                    <div className="font-bold uppercase text-[#1e3a8a]">{rfqDetail.origin || "—"}</div>
                    <div className="text-[9.5px] uppercase tracking-wider text-slate-500">{locTypeLabel} OF ORIGIN</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-600">To</div>
                    <div className="font-bold uppercase text-[#1e3a8a]">{rfqDetail.destination || "—"}</div>
                    <div className="text-[9.5px] uppercase tracking-wider text-slate-500">{locTypeLabel} OF DESTINATION</div>
                  </div>

                  {viaPort && (
                    <div>
                      <div className="text-[10px] text-slate-600">via / Routing</div>
                      <div className="font-bold uppercase text-slate-950">{viaPort}</div>
                    </div>
                  )}

                  {transitDays && (
                    <div>
                      <div className="text-[10px] text-slate-600">Estimated Transit Days</div>
                      <div className="font-bold text-slate-950">{transitDays}</div>
                    </div>
                  )}

                  {freeTime && (
                    <div>
                      <div className="text-[10px] text-slate-600">Detention / Free Time</div>
                      <div className="font-bold text-[#c2410c]">{freeTime}</div>
                    </div>
                  )}

                  <hr className="border-slate-300" />

                  <div>
                    <div className="mb-1 text-xs font-bold text-slate-950">Issued By (Sender)</div>
                    <div className="font-bold text-slate-900">
                      {senderName || <span className="italic text-amber-600">[Sender Name]</span>}
                    </div>
                    <div className="mt-0.5 space-y-0.5 text-[10.5px] leading-snug text-slate-700">
                      {senderAddr1 && <div>{senderAddr1}</div>}
                      {senderAddr2 && <div>{senderAddr2}</div>}
                      {senderAddr3 && <div>{senderAddr3}</div>}
                      {settings.iata_code && <div>IATA: {settings.iata_code}</div>}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-300 space-y-2">
                  <div className="text-xs font-bold text-slate-950">Contact</div>
                  {preparedBy && (
                    <div>
                      <div className="text-[10px] text-slate-600">Prepared by</div>
                      <div className="font-bold text-slate-950">{preparedBy}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] text-slate-600">Telephone</div>
                    <div className="font-bold text-slate-950">{senderPhone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600">Email</div>
                    <div className="break-all font-bold text-slate-950">{senderEmail || "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Legal & Page Footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-2.5 text-[9.5px] text-slate-500">
              <div>
                {[senderName, senderAddr1, senderAddr2, senderAddr3].filter(Boolean).join(" · ")}
              </div>
              <div className="font-medium text-slate-700">
                Quotation number <strong>{quoteNumber}</strong> &nbsp; Page 1 of 1
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "editor" && (
        <div className="space-y-6 rounded-xl border border-[#e5e3ee] bg-white p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-900">Issued By — Sender (Your Company)</h3>
              <Field label="Company Name *">
                <input type="text" className={inputClass} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              </Field>
              <Field label="Address Line 1 *">
                <textarea rows={2} className={inputClass} value={senderAddr1} onChange={(e) => setSenderAddr1(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="City / State">
                  <input type="text" className={inputClass} value={senderAddr2} onChange={(e) => setSenderAddr2(e.target.value)} />
                </Field>
                <Field label="Country / Tax / GST ID">
                  <input type="text" className={inputClass} value={senderAddr3} onChange={(e) => setSenderAddr3(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Prepared By">
                  <input type="text" className={inputClass} value={preparedBy} placeholder="Pricing Desk" onChange={(e) => setPreparedBy(e.target.value)} />
                </Field>
                <Field label="Phone Number">
                  <input type="text" className={inputClass} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <input type="email" className={inputClass} value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-900">Prepared For — Receiver (Customer)</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Customer Company Name *">
                  <input type="text" className={inputClass} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                </Field>
                <Field label="Attention / Salutation ('Dear …')">
                  <input type="text" className={inputClass} value={attentionName} onChange={(e) => setAttentionName(e.target.value)} />
                </Field>
              </div>
              <Field label="Address Line 1 *">
                <textarea rows={2} className={inputClass} value={receiverAddr1} onChange={(e) => setReceiverAddr1(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="City / Postal Code">
                  <input type="text" className={inputClass} value={receiverAddr2} onChange={(e) => setReceiverAddr2(e.target.value)} />
                </Field>
                <Field label="Country">
                  <input type="text" className={inputClass} value={receiverAddr3} onChange={(e) => setReceiverAddr3(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Customer Phone">
                  <input type="text" className={inputClass} value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
                </Field>
                <Field label="Customer Email">
                  <input type="email" className={inputClass} value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-6">
            <Field label="Quotation No. *">
              <input type="text" className={inputClass} value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
            </Field>
            <Field label="Valid From *">
              <input type="date" className={inputClass} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </Field>
            <Field label="Offer Expires On *">
              <input type="date" className={inputClass} value={validThrough} onChange={(e) => setValidThrough(e.target.value)} />
            </Field>
            <Field label="Offer Currency">
              <select
                className={inputClass}
                value={currency}
                onChange={(e) => {
                  const next = e.target.value;
                  setCurrency(next);
                  setCurrencySymbol(CURRENCY_SYMBOLS[next] || `${next} `);
                }}
              >
                {["USD", "INR", "EUR", "GBP", "AED", "SGD", "SAR"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Symbol">
              <input type="text" className={inputClass} value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} maxLength={5} />
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
                    })),
                  );
                }}
              />
            </Field>
          </div>

          {/* Sidebar Routing & Service Metadata */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-5">
            <Field label="Service & Incoterms">
              <input type="text" className={inputClass} value={serviceType} placeholder="OCEAN FCL · FOB" onChange={(e) => setServiceType(e.target.value)} />
            </Field>
            <Field label="Commodity Summary">
              <input type="text" className={inputClass} value={commodityLabel} placeholder="FAK / General Cargo" onChange={(e) => setCommodityLabel(e.target.value)} />
            </Field>
            <Field label="via / Transshipment">
              <input type="text" className={inputClass} value={viaPort} placeholder="e.g. Salalah, OM / Direct" onChange={(e) => setViaPort(e.target.value)} />
            </Field>
            <Field label="Est. Transit Days">
              <input type="text" className={inputClass} value={transitDays} placeholder="e.g. 18 – 22 Days" onChange={(e) => setTransitDays(e.target.value)} />
            </Field>
            <Field label="Detention / Free Time">
              <input type="text" className={inputClass} value={freeTime} placeholder="e.g. 14 Days Free Time" onChange={(e) => setFreeTime(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">Categorized Charge Lines (Freight / Origin / Destination)</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} onClick={() => addItem("export")}>
                  <Plus className="h-3.5 w-3.5" />
                  Origin Surcharge
                </button>
                <button type="button" className={secondaryClass} onClick={() => addItem("import")}>
                  <Plus className="h-3.5 w-3.5" />
                  Dest. Surcharge
                </button>
                <button type="button" className={secondaryClass} onClick={addDiscountItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Discount
                </button>
                <button type="button" className={buttonClass} onClick={() => addItem("freight")}>
                  <Plus className="h-3.5 w-3.5" />
                  Freight Line
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-semibold text-slate-700">
                    <th className="p-2.5" style={{ width: "130px" }}>Section</th>
                    <th className="p-2.5">Description &amp; Remark *</th>
                    <th className="p-2.5" style={{ width: "80px" }}>Curr.</th>
                    <th className="p-2.5" style={{ width: "115px" }}>Basis / Qty</th>
                    <th className="p-2.5" style={{ width: "110px" }}>Rate</th>
                    <th className="p-2.5" style={{ width: "110px" }}>Amount</th>
                    <th className="p-2.5" style={{ width: "95px" }}>Tax</th>
                    <th className="p-2.5 text-right" style={{ width: "44px" }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="p-2 align-top">
                        <select
                          className={inputClass}
                          value={item.category || ""}
                          onChange={(e) => updateItem(index, { category: e.target.value as QuoteChargeCategory })}
                        >
                          <option value="">Auto</option>
                          <option value="freight">Freight</option>
                          <option value="export">Export / Origin</option>
                          <option value="import">Import / Dest</option>
                          <option value="other">Other / Docs</option>
                        </select>
                      </td>
                      <td className="p-2 align-top space-y-1">
                        <input
                          type="text"
                          className={inputClass}
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                        />
                        <input
                          type="text"
                          className={`${inputClass} !py-1 text-[11px] text-slate-500`}
                          placeholder="Optional sub-note (e.g. Only Operating Reefers / to be paid collect)"
                          value={item.subtitle || ""}
                          onChange={(e) => updateItem(index, { subtitle: e.target.value })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          maxLength={4}
                          className={`${inputClass} uppercase font-mono`}
                          value={item.line_currency || currency}
                          onChange={(e) => updateItem(index, { line_currency: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          className={inputClass}
                          value={item.qty}
                          onChange={(e) => updateItem(index, { qty: e.target.value })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono`}
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono`}
                          value={item.subtotal}
                          onChange={(e) => updateItem(index, { subtotal: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          step="any"
                          className={`${inputClass} font-mono`}
                          value={item.tax}
                          onChange={(e) => updateItem(index, { tax: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2 text-right align-top">
                        <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Freight Inclusions Note (shown under Freight Charges)">
              <textarea rows={2} className={inputClass} value={inclusionsNote} onChange={(e) => setInclusionsNote(e.target.value)} />
            </Field>
            <Field label="Notes & Subject-To Charges (e.g. Subject to DO / BL fees)">
              <textarea
                rows={2}
                className={inputClass}
                placeholder="Subject to Destination Documentation Fee: USD 65 per B/L…"
                value={subjectToNotes}
                onChange={(e) => setSubjectToNotes(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Terms and Conditions</h3>
              <button
                type="button"
                className="text-xs text-[#7068cf] underline"
                onClick={() => setTerms(settings.quotation_terms_and_conditions || DEFAULT_TERMS)}
              >
                Reset to settings default
              </button>
            </div>
            <textarea rows={5} className={inputClass} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
        </div>
      )}

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
            padding: 12mm !important;
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
