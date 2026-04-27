"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { loadContent, type ContentBundle } from "@/data/loader";
import { getElementImageUrl } from "@/data/element-images";
import { goBackOr } from "@/lib/navigation";
import { useProgressStore } from "@/store/progressStore";
import type { Element } from "@/types";
import { ArrowLeft, Search, FlaskConical } from "lucide-react";
import AtomSpinner from "@/components/AtomSpinner";

type FilterCategory = "all" | "metals" | "nonmetals" | "noble" | "lanthanides" | "actinides";

const CATEGORY_FILTERS: { key: FilterCategory; label: string; categories: string[] }[] = [
  { key: "all", label: "All", categories: [] },
  { key: "metals", label: "Metals", categories: ["alkali-metal", "alkaline-earth-metal", "transition-metal", "post-transition-metal"] },
  { key: "nonmetals", label: "Nonmetals", categories: ["nonmetal", "halogen", "metalloid"] },
  { key: "noble", label: "Noble Gases", categories: ["noble-gas"] },
  { key: "lanthanides", label: "Lanthanides", categories: ["lanthanide"] },
  { key: "actinides", label: "Actinides", categories: ["actinide"] },
];

const CATEGORY_COLORS: Record<string, string> = {
  "alkali-metal": "#ef4444",
  "alkaline-earth-metal": "#f97316",
  "transition-metal": "#f59e0b",
  "post-transition-metal": "#a8a29e",
  metalloid: "#84cc16",
  nonmetal: "#3b82f6",
  halogen: "#8b5cf6",
  "noble-gas": "#06b6d4",
  lanthanide: "#ec4899",
  actinide: "#d946ef",
  unknown: "#94a3b8",
};

export default function PeriodicTablePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const progress = useProgressStore((s) => s.progress);
  const [content, setContent] = useState<ContentBundle | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);

  useEffect(() => {
    loadContent().then(setContent).catch(console.error);
  }, []);

  const elements = content?.elements ?? [];

  // "Discovered" element symbols — every element referenced by a mission
  // the player has earned at least one star on. Drives the periodic
  // table light-up: undiscovered elements render desaturated.
  const discoveredSymbols = useMemo(() => {
    if (!content) return new Set<string>();
    const earned = progress.filter((p) => p.stars > 0);
    const result = new Set<string>();
    for (const p of earned) {
      const m = content.missions.find((mm) => mm.missionId === p.missionId);
      if (!m) continue;
      for (const cond of m.successConditions) {
        if (cond.type === "build-atom") result.add(cond.targetElement);
        if (cond.type === "count-atoms") result.add(cond.element);
      }
      for (const el of m.allowedElements) result.add(el);
    }
    return result;
  }, [content, progress]);

  const filteredElements = useMemo(() => {
    let result = elements;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.symbol.toLowerCase().includes(q) ||
          e.atomicNumber.toString() === q
      );
    }
    const filterDef = CATEGORY_FILTERS.find((f) => f.key === filter);
    if (filterDef && filterDef.categories.length > 0) {
      result = result.filter((e) => filterDef.categories.includes(e.category));
    }
    return result;
  }, [elements, search, filter]);

  const mainElements = filteredElements.filter(
    (e) => e.category !== "lanthanide" && e.category !== "actinide"
  );
  const lanthanides = filteredElements.filter((e) => e.category === "lanthanide");
  const actinides = filteredElements.filter((e) => e.category === "actinide");

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh">
        <AtomSpinner size={56} />
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBackOr(router, "/")}
            className="p-2 rounded-lg hover:bg-slate-100 touch-target"
            aria-label={t("menu.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {t("periodic_table.title")}
            </h1>
            <p className="text-sm text-slate-500">
              {t("periodic_table.subtitle")}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("periodic_table.search")}
            className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter === f.key
                ? "border-primary bg-sky-50 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mobile: simple flow grid, ordered by atomic number — keeps cells big enough to tap. */}
      <div className="sm:hidden">
        <div className="grid grid-cols-3 gap-2">
          {filteredElements
            .slice()
            .sort((a, b) => a.atomicNumber - b.atomicNumber)
            .map((element) => {
              const img = getElementImageUrl(element.symbol);
              const discovered = discoveredSymbols.has(element.symbol);
              return (
                <button
                  key={element.symbol}
                  onClick={() => setSelectedElement(element)}
                  className={`aspect-square rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary hover:scale-105 transition-all shadow-sm ${
                    discovered ? "" : "grayscale opacity-50"
                  }`}
                  style={{ backgroundColor: CATEGORY_COLORS[element.category] || "#94a3b8" }}
                  aria-label={`${element.name}, atomic number ${element.atomicNumber}${discovered ? ", discovered" : ", not yet discovered"}`}
                >
                  {img ? (
                    /* Image is decorative — name + symbol are baked in. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-1">
                      <span className="text-[10px] leading-none opacity-80">{element.atomicNumber}</span>
                      <span className="text-base font-bold leading-tight">{element.symbol}</span>
                    </div>
                  )}
                </button>
              );
            })}
        </div>
        {filteredElements.length === 0 && (
          <p className="text-center text-slate-500 py-8">No elements match your filter.</p>
        )}
      </div>

      {/* Tablet+: real periodic-table layout. Horizontal scroll preserved as a fallback. */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Table grid */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(18, 1fr)` }}>
            {Array.from({ length: 7 }, (_, periodIdx) => {
              const period = periodIdx + 1;
              return Array.from({ length: 18 }, (_, groupIdx) => {
                const group = groupIdx + 1;
                const element = mainElements.find(
                  (e) => e.period === period && e.group === group
                );
                return (
                  <div key={`${period}-${group}`} className="aspect-square">
                    {element ? (
                      <PeriodicCell
                        element={element}
                        onSelect={setSelectedElement}
                        discovered={discoveredSymbols.has(element.symbol)}
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                );
              });
            })}
          </div>

          {/* Lanthanides & Actinides */}
          {(lanthanides.length > 0 || actinides.length > 0) && (
            <div className="mt-4 space-y-1">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(18, 1fr)` }}>
                {Array.from({ length: 2 }, (_, rowIdx) => {
                  const rowElements = rowIdx === 0 ? lanthanides : actinides;
                  return (
                    <Fragment key={rowIdx}>
                      <div className="aspect-square" />
                      <div className="aspect-square" />
                      <div className="aspect-square" />
                      {rowElements.map((element) => (
                        <div key={element.symbol} className="aspect-square">
                          <PeriodicCell
                            element={element}
                            onSelect={setSelectedElement}
                            discovered={discoveredSymbols.has(element.symbol)}
                          />
                        </div>
                      ))}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-6">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize text-slate-600">
              {cat.replace(/-/g, " ")}
            </span>
          </div>
        ))}
      </div>

      {/* Element Detail Modal */}
      {selectedElement && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4"
          onClick={() => setSelectedElement(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-2">
              {(() => {
                const img = getElementImageUrl(selectedElement.symbol);
                return img ? (
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`${selectedElement.name} card`}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 shadow-sm"
                      width={96}
                      height={96}
                    />
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-bold truncate">{selectedElement.name}</h2>
                      <p className="text-slate-500 text-sm">
                        {selectedElement.atomicNumber} · {selectedElement.category.replace(/-/g, " ")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold shrink-0"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[selectedElement.category] || "#94a3b8",
                      }}
                    >
                      {selectedElement.symbol}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold truncate">{selectedElement.name}</h2>
                      <p className="text-slate-500 text-sm">
                        {selectedElement.atomicNumber} · {selectedElement.category.replace(/-/g, " ")}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <button
                onClick={() => setSelectedElement(null)}
                className="p-2 rounded-lg hover:bg-slate-100 shrink-0"
                aria-label="Close"
              >
                <ArrowLeft className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">{t("periodic_table.atomic_weight")}</div>
                <div className="font-semibold">{selectedElement.standardAtomicWeight}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">{t("periodic_table.state")}</div>
                <div className="font-semibold capitalize">{selectedElement.stateAtStp}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">{t("periodic_table.group")}</div>
                <div className="font-semibold">{selectedElement.group ?? "—"}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">{t("periodic_table.period")}</div>
                <div className="font-semibold">{selectedElement.period}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">{t("periodic_table.electrons")}</div>
                <div className="font-semibold">{selectedElement.valenceElectronsMainGroup}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <div className="text-xs text-slate-500">Electronegativity</div>
                <div className="font-semibold">
                  {selectedElement.electronegativityPauling ?? "—"}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {t("periodic_table.fact")}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {selectedElement.name} has {selectedElement.atomicNumber} protons
                and its electron configuration is{" "}
                {selectedElement.shellOccupancy.join("-")}.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface PeriodicCellProps {
  element: Element;
  onSelect: (e: Element) => void;
  discovered?: boolean;
}

function PeriodicCell({ element, onSelect, discovered = true }: PeriodicCellProps) {
  const img = getElementImageUrl(element.symbol);
  return (
    <button
      onClick={() => onSelect(element)}
      className={`w-full h-full rounded-md overflow-hidden flex flex-col items-center justify-center text-white transition-all hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary relative ${
        discovered ? "" : "grayscale opacity-50"
      }`}
      style={{ backgroundColor: CATEGORY_COLORS[element.category] || "#94a3b8" }}
      aria-label={`${element.name}, atomic number ${element.atomicNumber}${discovered ? ", discovered" : ", not yet discovered"}`}
    >
      {img ? (
        // Card art has the symbol/number/name baked in; the colored backdrop
        // fills the brief gap before the image loads.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-1">
          <span className="text-[10px] leading-none opacity-80">{element.atomicNumber}</span>
          <span className="text-sm sm:text-base font-bold leading-tight">{element.symbol}</span>
        </div>
      )}
    </button>
  );
}
