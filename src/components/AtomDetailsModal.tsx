"use client";

import type { Element } from "@/types";
import { X, FlaskConical } from "lucide-react";

interface AtomDetailsModalProps {
  element: Element;
  onClose: () => void;
}

// Modal showing the full property sheet for an element. Triggered from
// the canvas when the player selects an atom — gives them the data
// behind the visualization (protons + neutrons in the nucleus, the
// shell occupancies driving the orbital electrons, etc.).
//
// Intentionally separate from the periodic-table page's inline modal:
// that one is built around the discoverable card art, this one is
// built around the in-mission canvas context. They can be unified
// later if it becomes maintenance burden.
export default function AtomDetailsModal({
  element,
  onClose,
}: AtomDetailsModalProps) {
  const protons = element.atomicNumber;
  const neutrons = Math.max(
    0,
    Math.round(element.standardAtomicWeight) - protons
  );
  const shells = element.shellOccupancy ?? [];
  const oxidations = element.commonOxidationStates ?? [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="atom-details-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-sm"
              style={{ backgroundColor: element.colorToken }}
            >
              {element.symbol}
            </div>
            <div className="min-w-0">
              <h2
                id="atom-details-title"
                className="text-2xl font-bold truncate"
              >
                {element.name}
              </h2>
              <p className="text-sm text-slate-600">
                #{element.atomicNumber} · {element.category.replace(/-/g, " ")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nucleus + shells block */}
        <section className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Atomic structure
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-700" />
                <span className="text-slate-600">Protons</span>
              </div>
              <div className="font-semibold text-base mt-0.5">{protons}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600" />
                <span className="text-slate-600">Neutrons</span>
              </div>
              <div className="font-semibold text-base mt-0.5">{neutrons}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                most-common isotope
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-slate-600 mb-1">Electron shells</div>
              <div className="font-semibold text-base">
                {shells.length > 0 ? shells.join(" · ") : "—"}
              </div>
              {shells.length > 0 && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {shells.length === 1
                    ? "1 shell"
                    : `${shells.length} shells, innermost first`}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Periodic-table coordinates + bulk properties */}
        <section className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Properties
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <PropRow
              label="Atomic weight"
              value={`${element.standardAtomicWeight} u`}
            />
            <PropRow
              label="State at STP"
              value={element.stateAtStp}
              capitalize
            />
            <PropRow label="Group" value={element.group ?? "—"} />
            <PropRow label="Period" value={element.period} />
            <PropRow label="Block" value={element.block.toUpperCase()} />
            <PropRow
              label="Valence electrons"
              value={element.valenceElectronsMainGroup}
            />
            <PropRow
              label="Electronegativity"
              value={element.electronegativityPauling ?? "—"}
            />
            <PropRow
              label="Oxidation states"
              value={
                oxidations.length > 0
                  ? oxidations
                      .map((c) => (c > 0 ? `+${c}` : `${c}`))
                      .join(", ")
                  : "—"
              }
            />
          </div>
        </section>

        {/* Did-you-know */}
        <section className="p-3 rounded-xl bg-sky-50 border border-sky-100">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Did you know?
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-snug">
            {element.name} has {protons} proton{protons === 1 ? "" : "s"}
            {neutrons > 0
              ? ` and ${neutrons} neutron${neutrons === 1 ? "" : "s"} in its nucleus`
              : ""}
            {shells.length > 0
              ? `, with electrons arranged ${shells.join("-")}.`
              : "."}
          </p>
        </section>
      </div>
    </div>
  );
}

function PropRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string | number;
  capitalize?: boolean;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50">
      <div className="text-[11px] text-slate-600 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-semibold text-sm mt-0.5 ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
