"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  blankCargo,
  blankDimensionItem,
  calcDimensionItem,
  calculateConsignmentTotals,
  recalculateCommodityCargo,
  type Cargo,
  type DimensionItem,
} from "@/lib/freight";
import { CargoDetailsEditor } from "./cargo-details-editor";
import { Field, inputClass, secondaryClass } from "./shared";

export function RfqCargoEditor({
  mode,
  airDivisor,
  onAirDivisorChange,
  cargo,
  onChangeCargo,
  totalChargeableWeight,
  chargeableWeightManual,
  onChangeChargeableWeight,
  cargoNotes,
  onChangeCargoNotes,
  hasAiPrefill = false,
}: {
  mode: string;
  airDivisor: "standard" | "express";
  onAirDivisorChange: (value: "standard" | "express") => void;
  cargo: Cargo[];
  onChangeCargo: (next: Cargo[]) => void;
  totalChargeableWeight: string;
  chargeableWeightManual: boolean;
  onChangeChargeableWeight: (value: string, manual: boolean) => void;
  cargoNotes: string;
  onChangeCargoNotes: (value: string) => void;
  hasAiPrefill?: boolean;
}) {
  const safeCargo = cargo.length > 0 ? cargo : [blankCargo()];
  const totals = calculateConsignmentTotals(safeCargo);
  const displayedCW = chargeableWeightManual
    ? totalChargeableWeight
    : totals.autoChargeableWeightKg > 0
      ? totals.autoChargeableWeightKg.toFixed(2)
      : "";

  const syncWithTotals = (nextList: Cargo[], nextManual = chargeableWeightManual, nextManualVal = totalChargeableWeight) => {
    const nextTotals = calculateConsignmentTotals(nextList);
    onChangeCargo(nextList);
    if (!nextManual) {
      onChangeChargeableWeight(
        nextTotals.autoChargeableWeightKg > 0 ? nextTotals.autoChargeableWeightKg.toFixed(2) : "",
        false,
      );
    } else {
      onChangeChargeableWeight(nextManualVal, true);
    }
  };

  const updateCommodityField = (index: number, key: keyof Cargo, val: string) => {
    const nextList = safeCargo.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [key]: val };
      if (key === "weight_unit") {
        const dims =
          updated.dimension_items && updated.dimension_items.length > 0
            ? updated.dimension_items
            : [blankDimensionItem()];
        return recalculateCommodityCargo(updated, dims, mode, airDivisor);
      }
      return updated;
    });
    syncWithTotals(nextList);
  };

  const addCommodity = () => {
    syncWithTotals([...safeCargo, blankCargo()]);
  };

  const removeCommodity = (index: number) => {
    if (safeCargo.length <= 1) return;
    syncWithTotals(safeCargo.filter((_, idx) => idx !== index));
  };

  const addDimension = (commodityIndex: number) => {
    const nextList = safeCargo.map((item, idx) => {
      if (idx !== commodityIndex) return item;
      const currentDims =
        item.dimension_items && item.dimension_items.length > 0
          ? item.dimension_items
          : [blankDimensionItem()];
      return recalculateCommodityCargo(
        item,
        [...currentDims, blankDimensionItem()],
        mode,
        airDivisor,
      );
    });
    syncWithTotals(nextList);
  };

  const removeDimension = (commodityIndex: number, dimensionIndex: number) => {
    const nextList = safeCargo.map((item, idx) => {
      if (idx !== commodityIndex) return item;
      if (!item.dimension_items || item.dimension_items.length <= 1) return item;
      const nextDims = item.dimension_items.filter((_, dIdx) => dIdx !== dimensionIndex);
      return recalculateCommodityCargo(item, nextDims, mode, airDivisor);
    });
    syncWithTotals(nextList);
  };

  const changeDimension = (
    commodityIndex: number,
    dimensionIndex: number,
    key: keyof DimensionItem,
    rawValue: string,
  ) => {
    const nextList = safeCargo.map((item, idx) => {
      if (idx !== commodityIndex) return item;
      const currentDims =
        item.dimension_items && item.dimension_items.length > 0
          ? [...item.dimension_items]
          : [blankDimensionItem()];
      const current = currentDims[dimensionIndex] || blankDimensionItem();
      const updatedDim: DimensionItem = {
        ...current,
        [key]: [
          "pieces",
          "length",
          "width",
          "height",
          "gross_weight",
          "volume",
          "volumetric_weight",
        ].includes(key)
          ? Math.max(0, Number(rawValue) || 0)
          : rawValue,
      };
      if (key === "pieces") {
        updatedDim.pieces = Math.max(1, Number(rawValue) || 1);
      }
      if (["length", "width", "height", "unit", "pieces"].includes(key)) {
        const calc = calcDimensionItem(updatedDim, mode, airDivisor);
        if (calc.volume > 0) {
          updatedDim.volume = calc.volume;
          updatedDim.volumetric_weight = calc.volumetric_weight;
        }
      } else if (key === "volume") {
        // Standalone CBM edited directly: clear L/W/H if 0 and auto-calculate volumetric weight from CBM
        const volVal = Math.max(0, Number(rawValue) || 0);
        updatedDim.volume = volVal;
        if (!(updatedDim.length > 0 && updatedDim.width > 0 && updatedDim.height > 0)) {
          if (mode === "air") {
            const airDiv = airDivisor === "express" ? 5000 : 6000;
            updatedDim.volumetric_weight = Number((volVal * (1000000 / airDiv)).toFixed(2));
          } else if (mode === "road") {
            updatedDim.volumetric_weight = Number((volVal * (1000000 / 3000)).toFixed(2));
          } else {
            updatedDim.volumetric_weight = Number((volVal * 1000).toFixed(2));
          }
        }
      }
      currentDims[dimensionIndex] = updatedDim;
      return recalculateCommodityCargo(item, currentDims, mode, airDivisor);
    });
    syncWithTotals(nextList);
  };

  const handleDivisorChange = (nextDivisor: "standard" | "express") => {
    onAirDivisorChange(nextDivisor);
    const nextList = safeCargo.map((item) => {
      const dims =
        item.dimension_items && item.dimension_items.length > 0
          ? item.dimension_items
          : [blankDimensionItem()];
      return recalculateCommodityCargo(item, dims, mode, nextDivisor);
    });
    syncWithTotals(nextList);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#393945]">
            Cargo Particulars &amp; Chargeable Weight
          </h3>
          <p className="mt-0.5 text-[11px] text-[#777884]">
            {hasAiPrefill
              ? "Pre-filled by AI/email parser per commodity. Review and edit any pieces, dimensions, or weights, or add another commodity."
              : "Enter pieces, dimensions, and gross weight per commodity to calculate volume, volumetric weight, and chargeable weight."}
          </p>
        </div>
        <button
          type="button"
          className={secondaryClass}
          onClick={addCommodity}
        >
          <Plus className="h-3.5 w-3.5" />
          Add commodity
        </button>
      </div>

      <div className="space-y-4">
        {safeCargo.map((c, i) => {
          const dimensionItems =
            c.dimension_items && c.dimension_items.length > 0
              ? c.dimension_items
              : [blankDimensionItem()];

          return (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-[#e5e3ee] bg-white p-4 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-[#eeecf5] pb-2 text-xs font-semibold text-[#1f2029]">
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-700">
                    {i + 1}
                  </span>
                  Commodity {i + 1}
                </span>
                <button
                  type="button"
                  disabled={safeCargo.length <= 1}
                  aria-label={`Remove commodity ${i + 1}`}
                  className="text-[#858693] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  onClick={() => removeCommodity(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <Field label="Commodity description">
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. Automotive spare parts, Electronics"
                      value={c.description || ""}
                      onChange={(e) => updateCommodityField(i, "description", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="HS / Tariff code">
                  <input
                    type="text"
                    aria-label={`HS code commodity ${i + 1}`}
                    className={inputClass}
                    placeholder="e.g. 8413.70"
                    value={c.commodity_number || ""}
                    onChange={(e) => updateCommodityField(i, "commodity_number", e.target.value)}
                  />
                </Field>
                <Field label="Weight unit">
                  <select
                    aria-label={`Weight unit commodity ${i + 1}`}
                    className={inputClass}
                    value={c.weight_unit || "kg"}
                    onChange={(e) => updateCommodityField(i, "weight_unit", e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </Field>
              </div>

              <div className="space-y-2 rounded-lg border border-[#eeecf5] bg-[#faf9fd] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#4e4f62]">
                    Package Dimensions &amp; Weights ·{" "}
                    <span className="font-normal text-[#777884]">
                      {mode === "air"
                        ? airDivisor === "express"
                          ? "Express divisor /5,000 cm (139 in)"
                          : "IATA Air divisor /6,000 cm (166 in)"
                        : mode === "ocean"
                          ? "Ocean W/M: 1 m³ = 1,000 kg"
                          : mode === "road"
                            ? "Road divisor /3,000 cm (1 m³ = 333.33 kg)"
                            : "Standard 1 m³ = 1,000 kg"}
                    </span>
                  </span>
                  {mode === "air" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#777884]">Divisor:</span>
                      <select
                        aria-label="Air volumetric divisor"
                        className={`${inputClass} !h-6 !w-auto !px-2 !py-0 text-[11px]`}
                        value={airDivisor}
                        onChange={(e) =>
                          handleDivisorChange(e.target.value === "express" ? "express" : "standard")
                        }
                      >
                        <option value="standard">Standard Air (6,000 / 166)</option>
                        <option value="express">Express Courier (5,000 / 139)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#eeecf5] text-[11px] text-[#777884]">
                        <th className="pb-1.5 pr-2 font-medium">Pieces</th>
                        <th className="pb-1.5 pr-2 font-medium">Length</th>
                        <th className="pb-1.5 pr-2 font-medium">Width</th>
                        <th className="pb-1.5 pr-2 font-medium">Height</th>
                        <th className="pb-1.5 pr-2 font-medium">Unit</th>
                        <th className="pb-1.5 pr-2 font-medium">Gross Wt ({c.weight_unit || "kg"})</th>
                        <th className="pb-1.5 pr-2 font-medium">Volume (m³)</th>
                        <th className="pb-1.5 pr-2 font-medium">Vol. Wt (kg)</th>
                        <th className="w-7 pb-1.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0eef9]">
                      {dimensionItems.map((dim, j) => (
                        <tr key={j}>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              aria-label={`Commodity ${i + 1} row ${j + 1} pieces`}
                              className={`${inputClass} !h-7 min-w-[62px] !px-2 !py-0 text-xs`}
                              value={dim.pieces || 1}
                              onChange={(e) => changeDimension(i, j, "pieces", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              aria-label={`Commodity ${i + 1} row ${j + 1} length`}
                              className={`${inputClass} !h-7 min-w-[66px] !px-2 !py-0 text-xs`}
                              value={dim.length || ""}
                              onChange={(e) => changeDimension(i, j, "length", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              aria-label={`Commodity ${i + 1} row ${j + 1} width`}
                              className={`${inputClass} !h-7 min-w-[66px] !px-2 !py-0 text-xs`}
                              value={dim.width || ""}
                              onChange={(e) => changeDimension(i, j, "width", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              aria-label={`Commodity ${i + 1} row ${j + 1} height`}
                              className={`${inputClass} !h-7 min-w-[66px] !px-2 !py-0 text-xs`}
                              value={dim.height || ""}
                              onChange={(e) => changeDimension(i, j, "height", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <select
                              aria-label={`Commodity ${i + 1} row ${j + 1} unit`}
                              className={`${inputClass} !h-7 min-w-[58px] !px-1.5 !py-0 text-xs`}
                              value={dim.unit || "cm"}
                              onChange={(e) => changeDimension(i, j, "unit", e.target.value)}
                            >
                              <option value="cm">cm</option>
                              <option value="in">in</option>
                              <option value="m">m</option>
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              aria-label={`Commodity ${i + 1} row ${j + 1} gross weight`}
                              className={`${inputClass} !h-7 min-w-[74px] !px-2 !py-0 text-xs`}
                              value={dim.gross_weight || ""}
                              onChange={(e) => changeDimension(i, j, "gross_weight", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.0000"
                              aria-label={`Commodity ${i + 1} row ${j + 1} volume`}
                              className={`${inputClass} !h-7 min-w-[76px] !px-2 !py-0 font-mono text-xs`}
                              value={dim.volume ? Number(dim.volume.toFixed(4)) : ""}
                              onChange={(e) => changeDimension(i, j, "volume", e.target.value)}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              aria-label={`Commodity ${i + 1} row ${j + 1} volumetric weight`}
                              className={`${inputClass} !h-7 min-w-[74px] !px-2 !py-0 font-mono text-xs`}
                              value={
                                dim.volumetric_weight !== undefined && dim.volumetric_weight !== null
                                  ? dim.volumetric_weight
                                  : ""
                              }
                              onChange={(e) =>
                                changeDimension(i, j, "volumetric_weight", e.target.value)
                              }
                            />
                          </td>
                          <td className="py-1.5 text-center">
                            <button
                              type="button"
                              disabled={dimensionItems.length <= 1}
                              aria-label="Remove dimension row"
                              className="text-[#858693] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                              onClick={() => removeDimension(i, j)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeecf5] pt-2">
                  <button
                    type="button"
                    className={`${secondaryClass} !px-2.5 !py-1 text-xs`}
                    onClick={() => addDimension(i)}
                  >
                    <Plus className="h-3 w-3" />
                    Add dimension
                  </button>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#606174]">
                    <span>Pieces: <strong>{c.pieces || 0}</strong></span>
                    <span>•</span>
                    <span>Gross: <strong>{Number(c.gross_weight || 0).toFixed(2)} {c.weight_unit || "kg"}</strong></span>
                    <span>•</span>
                    <span>Vol: <strong>{Number(c.volume || 0).toFixed(4)} m³</strong></span>
                    <span>•</span>
                    <span>Vol. Wt: <strong>{Number(c.volumetric_weight || 0).toFixed(2)} kg</strong></span>
                    <span>•</span>
                    <span className="text-indigo-700">Chargeable: <strong>{Number(c.chargeable_weight || 0).toFixed(2)} kg</strong></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Consignment Totals & Chargeable Weight */}
      <div className="space-y-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-[#faf9fd] to-[#f4f2ff] p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
              Consignment Totals &amp; Chargeable Weight
            </h4>
            <p className="text-[11px] text-[#777884]">
              Totalled across {safeCargo.length} {safeCargo.length === 1 ? "commodity" : "commodities"} ·{" "}
              {totals.totalPieces} {totals.totalPieces === 1 ? "piece" : "pieces"}
            </p>
          </div>
          {chargeableWeightManual && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 underline"
              onClick={() =>
                onChangeChargeableWeight(
                  totals.autoChargeableWeightKg > 0
                    ? totals.autoChargeableWeightKg.toFixed(2)
                    : "",
                  false,
                )
              }
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Auto
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#eeecf5] bg-white p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777884]">
              Total Gross Wt
            </div>
            <div className="mt-1 text-base font-bold text-[#1f2029]">
              {totals.totalGrossKg.toFixed(2)} <span className="text-xs font-normal text-[#858693]">kg</span>
            </div>
          </div>
          <div className="rounded-lg border border-[#eeecf5] bg-white p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777884]">
              Total Vol. Weight
            </div>
            <div className="mt-1 text-base font-bold text-[#1f2029]">
              {totals.totalVolumetricKg.toFixed(2)} <span className="text-xs font-normal text-[#858693]">kg</span>
            </div>
          </div>
          <div className="rounded-lg border border-[#eeecf5] bg-white p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#777884]">
              Total Volume
            </div>
            <div className="mt-1 text-base font-bold text-[#1f2029]">
              {totals.totalVolumeCbm.toFixed(4)} <span className="text-xs font-normal text-[#858693]">m³</span>
            </div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-white p-2.5">
            <label htmlFor="rfq-chargeable-weight" className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-800">
              Chargeable Wt (kg)
            </label>
            <input
              id="rfq-chargeable-weight"
              type="number"
              min="0"
              step="any"
              className={`${inputClass} mt-1 !h-7 !px-2 !py-0 font-mono text-sm font-bold text-indigo-950`}
              value={displayedCW}
              onChange={(e) => onChangeChargeableWeight(e.target.value, true)}
            />
            <div className="mt-0.5 text-[10px] text-[#777884]">
              {(Number(displayedCW || 0) * 2.20462262).toFixed(2)} lb
            </div>
          </div>
        </div>
      </div>

      <details className="rounded-xl border border-[#e5e3ee] bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#606174]">
          Additional cargo &amp; request notes (raw text)
        </summary>
        <div className="mt-3">
          <CargoDetailsEditor value={cargoNotes} onChange={onChangeCargoNotes} />
        </div>
      </details>
    </div>
  );
}
