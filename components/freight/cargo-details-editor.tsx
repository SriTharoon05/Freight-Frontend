"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { inputClass, secondaryClass } from "./shared";

export function CargoDetailsEditor({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const placeholder = "Commodity / description:\nPackages and packing:\nGross / chargeable weight:\nVolume and dimensions:\nCargo ready date:\nHandling requirements and Incoterms:";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="rfq-cargo" className="text-xs font-semibold text-[#606174]">Cargo and request details</label>
        <button type="button" className={secondaryClass} onClick={() => setExpanded(true)}>
          <Maximize2 className="h-3.5 w-3.5" /> Expand editor
        </button>
      </div>
      <p id="rfq-cargo-help" className="mb-3 text-xs leading-relaxed text-[#777884]">
        Review cargo facts from the customer emails. Add missing particulars and remove superseded details before saving.
      </p>
      <textarea id="rfq-cargo" aria-describedby="rfq-cargo-help" rows={10} maxLength={4000}
        className={inputClass + " min-h-[240px] resize-y leading-relaxed"}
        placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      <p className="mt-1 text-right text-[11px] text-[#858693]">{value.length.toLocaleString()} / 4,000 characters</p>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex max-h-[95dvh] w-[calc(100%-2rem)] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>Cargo and request details</DialogTitle>
            <DialogDescription>Changes are kept in your RFQ draft as you type.</DialogDescription>
          </DialogHeader>
          <textarea aria-label="Expanded cargo details" autoFocus maxLength={4000}
            className={inputClass + " h-[60dvh] min-h-[240px] resize-y leading-relaxed"}
            placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#777884]">{value.length.toLocaleString()} / 4,000 characters</span>
            <button type="button" className={secondaryClass} onClick={() => setExpanded(false)}>Done</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
