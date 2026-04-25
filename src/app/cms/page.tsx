"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProgressStore } from "@/store/progressStore";
import {
  ArrowLeft,
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Atom,
  FlaskConical,
  Target,
  Zap,
} from "lucide-react";
import type { Element, Molecule, Mission, Reaction } from "@/types";

type TabType = "elements" | "molecules" | "missions" | "reactions";

export default function CMSPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const adultSession = useProgressStore((s) => s.adultSession);
  const setAdultSession = useProgressStore((s) => s.setAdultSession);

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("elements");

  const CORRECT_PIN = "1234";

  if (!adultSession || adultSession.expiresAt < Date.now()) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <button
          onClick={() => router.push("/")}
          className="absolute top-4 left-4 flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          {t("menu.back")}
        </button>
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6">
            {t("cms.title")}
          </h1>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setPinError("");
            }}
            placeholder="Enter 4-digit PIN"
            className="w-full px-4 py-3 rounded-lg border border-slate-300 text-center text-2xl tracking-widest focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
            autoFocus
          />
          {pinError && (
            <p className="text-error text-sm text-center mt-2">{pinError}</p>
          )}
          <button
            onClick={() => {
              if (pin === CORRECT_PIN) {
                setAdultSession({
                  type: "parent",
                  pin,
                  createdAt: Date.now(),
                  expiresAt: Date.now() + 30 * 60 * 1000,
                });
              } else {
                setPinError(t("dashboard.pin_error"));
              }
            }}
            disabled={pin.length !== 4}
            className="w-full mt-4 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {t("dashboard.pin_enter")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full p-4">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-slate-500 hover:text-foreground touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
          {t("menu.back")}
        </button>
        <h1 className="text-2xl font-bold">{t("cms.title")}</h1>
        <div className="w-8" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {([
          { key: "elements" as TabType, icon: Atom, label: t("cms.tab_elements") },
          { key: "molecules" as TabType, icon: FlaskConical, label: t("cms.tab_molecules") },
          { key: "missions" as TabType, icon: Target, label: t("cms.tab_missions") },
          { key: "reactions" as TabType, icon: Zap, label: t("cms.tab_reactions") },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "elements" && <ElementsEditor />}
      {activeTab === "molecules" && <MoleculesEditor />}
      {activeTab === "missions" && <MissionsEditor />}
      {activeTab === "reactions" && <ReactionsEditor />}
    </main>
  );
}

// ============================================================================
// Elements Editor
// ============================================================================

function ElementsEditor() {
  const [elements, setElements] = useState<Element[]>([]);
  const [editing, setEditing] = useState<Element | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/data/elements.json")
      .then((r) => r.json())
      .then(setElements);
  }, []);

  const save = () => {
    if (!editing) return;
    const newElements = isNew
      ? [...elements, editing]
      : elements.map((e) => (e.atomicNumber === editing.atomicNumber ? editing : e));
    setElements(newElements);
    downloadJson(newElements, "elements.json");
    setEditing(null);
    setIsNew(false);
  };

  const remove = (an: number) => {
    const newElements = elements.filter((e) => e.atomicNumber !== an);
    setElements(newElements);
    downloadJson(newElements, "elements.json");
  };

  if (editing) {
    return (
      <EditorForm
        title={isNew ? "New Element" : `Edit ${editing.name}`}
        fields={[
          { key: "atomicNumber", label: "Atomic Number", type: "number" },
          { key: "symbol", label: "Symbol", type: "text" },
          { key: "name", label: "Name", type: "text" },
          { key: "group", label: "Group", type: "number" },
          { key: "period", label: "Period", type: "number" },
          { key: "block", label: "Block", type: "select", options: ["s", "p", "d", "f"] },
          { key: "category", label: "Category", type: "text" },
          { key: "standardAtomicWeight", label: "Atomic Weight", type: "number" },
          { key: "stateAtStp", label: "State at STP", type: "select", options: ["solid", "liquid", "gas"] },
          { key: "valenceElectronsMainGroup", label: "Valence Electrons", type: "number" },
          { key: "electronegativityPauling", label: "Electronegativity", type: "number" },
          { key: "colorToken", label: "Color", type: "text" },
        ]}
        data={editing as unknown as Record<string, unknown>}
        onChange={(key, value) => {
          if (key === "atomicNumber" || key === "group" || key === "period" || key === "valenceElectronsMainGroup") {
            setEditing({ ...editing, [key]: parseInt(value as string) || 0 });
          } else if (key === "standardAtomicWeight") {
            setEditing({ ...editing, [key]: parseFloat(value as string) || 0 });
          } else if (key === "electronegativityPauling") {
            const num = parseFloat(value as string);
            setEditing({ ...editing, [key]: isNaN(num) ? null : num });
          } else {
            setEditing({ ...editing, [key]: value });
          }
        }}
        onSave={save}
        onCancel={() => {
          setEditing(null);
          setIsNew(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Elements ({elements.length})</h2>
        <button
          onClick={() => {
            setEditing({
              atomicNumber: elements.length > 0 ? Math.max(...elements.map((e) => e.atomicNumber)) + 1 : 1,
              symbol: "",
              name: "",
              group: 1,
              period: 1,
              block: "s",
              category: "unknown",
              standardAtomicWeight: 0,
              stateAtStp: "solid",
              shellOccupancy: [0],
              valenceElectronsMainGroup: 0,
              commonOxidationStates: [0],
              electronegativityPauling: null,
              colorToken: "#94a3b8",
              iconAsset: null,
              unlockWorld: "encyclopedia",
              factCardKey: "",
              sourceRef: "",
            });
            setIsNew(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
      <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
        {elements.map((el) => (
          <div
            key={el.atomicNumber}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-primary transition-colors"
          >
            <button
              onClick={() => {
                setEditing(el);
                setIsNew(false);
              }}
              className="flex items-center gap-3 text-left flex-1"
            >
              <span
                className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: el.colorToken }}
              >
                {el.symbol}
              </span>
              <div>
                <div className="font-medium">
                  {el.name} ({el.symbol})
                </div>
                <div className="text-xs text-slate-500">
                  #{el.atomicNumber} · {el.category.replace(/-/g, " ")}
                </div>
              </div>
            </button>
            <button
              onClick={() => remove(el.atomicNumber)}
              className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Molecules Editor
// ============================================================================

function MoleculesEditor() {
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [editing, setEditing] = useState<Molecule | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/data/molecules.json")
      .then((r) => r.json())
      .then(setMolecules);
  }, []);

  const save = () => {
    if (!editing) return;
    const newMolecules = isNew
      ? [...molecules, editing]
      : molecules.map((m) => (m.moleculeId === editing.moleculeId ? editing : m));
    setMolecules(newMolecules);
    downloadJson(newMolecules, "molecules.json");
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    const newMolecules = molecules.filter((m) => m.moleculeId !== id);
    setMolecules(newMolecules);
    downloadJson(newMolecules, "molecules.json");
  };

  if (editing) {
    return (
      <EditorForm
        title={isNew ? "New Molecule" : `Edit ${editing.displayName}`}
        fields={[
          { key: "moleculeId", label: "ID", type: "text" },
          { key: "displayName", label: "Name", type: "text" },
          { key: "formulaHill", label: "Formula", type: "text" },
          { key: "ageBand", label: "Age Band", type: "select", options: ["6-7", "8-10", "11-14", "15-16"] },
          { key: "difficulty", label: "Difficulty", type: "select", options: ["1", "2", "3", "4", "5"] },
        ]}
        data={editing as unknown as Record<string, unknown>}
        onChange={(key, value) => {
          if (key === "difficulty") {
            setEditing({ ...editing, [key]: parseInt(value as string) as 1 | 2 | 3 | 4 | 5 });
          } else {
            setEditing({ ...editing, [key]: value });
          }
        }}
        onSave={save}
        onCancel={() => {
          setEditing(null);
          setIsNew(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Molecules ({molecules.length})</h2>
        <button
          onClick={() => {
            setEditing({
              moleculeId: "new_molecule",
              displayName: "New Molecule",
              formulaHill: "",
              ageBand: "8-10",
              allowedBondGraph: { nodes: [], edges: [] },
              synonyms: [],
              difficulty: 1,
              uses3dTemplate: false,
              factKey: "",
            });
            setIsNew(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
      <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
        {molecules.map((mol) => (
          <div
            key={mol.moleculeId}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-primary transition-colors"
          >
            <button
              onClick={() => {
                setEditing(mol);
                setIsNew(false);
              }}
              className="text-left flex-1"
            >
              <div className="font-medium">
                {mol.displayName} ({mol.formulaHill})
              </div>
              <div className="text-xs text-slate-500">
                Age {mol.ageBand} · Difficulty {mol.difficulty}
              </div>
            </button>
            <button
              onClick={() => remove(mol.moleculeId)}
              className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Missions Editor
// ============================================================================

function MissionsEditor() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/data/missions.json")
      .then((r) => r.json())
      .then(setMissions);
  }, []);

  const save = () => {
    if (!editing) return;
    const newMissions = isNew
      ? [...missions, editing]
      : missions.map((m) => (m.missionId === editing.missionId ? editing : m));
    setMissions(newMissions);
    downloadJson(newMissions, "missions.json");
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    const newMissions = missions.filter((m) => m.missionId !== id);
    setMissions(newMissions);
    downloadJson(newMissions, "missions.json");
  };

  if (editing) {
    return (
      <EditorForm
        title={isNew ? "New Mission" : `Edit ${editing.title}`}
        fields={[
          { key: "missionId", label: "ID", type: "text" },
          { key: "title", label: "Title", type: "text" },
          { key: "brief", label: "Brief", type: "textarea" },
          { key: "worldId", label: "World", type: "select", options: ["foundations", "core"] },
          { key: "objectiveType", label: "Objective", type: "select", options: ["build-atom", "build-molecule", "run-reaction", "count-atoms"] },
          { key: "estimatedMinutes", label: "Minutes", type: "number" },
          { key: "difficulty", label: "Difficulty", type: "select", options: ["1", "2", "3", "4", "5"] },
          { key: "ageBand", label: "Age Band", type: "select", options: ["6-7", "8-10", "11-14", "15-16"] },
        ]}
        data={editing as unknown as Record<string, unknown>}
        onChange={(key, value) => {
          if (key === "estimatedMinutes" || key === "difficulty") {
            setEditing({ ...editing, [key]: parseInt(value as string) || 0 });
          } else {
            setEditing({ ...editing, [key]: value });
          }
        }}
        onSave={save}
        onCancel={() => {
          setEditing(null);
          setIsNew(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Missions ({missions.length})</h2>
        <button
          onClick={() => {
            setEditing({
              missionId: "new_mission",
              worldId: "foundations",
              title: "New Mission",
              brief: "",
              objectiveType: "build-molecule",
              allowedElements: [],
              allowedMolecules: [],
              successConditions: [],
              hintSetId: "",
              estimatedMinutes: 5,
              standardsTags: [],
              teacherNotes: "",
              difficulty: 1,
              ageBand: "8-10",
              prerequisites: [],
            });
            setIsNew(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
      <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
        {missions.map((mission) => (
          <div
            key={mission.missionId}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-primary transition-colors"
          >
            <button
              onClick={() => {
                setEditing(mission);
                setIsNew(false);
              }}
              className="text-left flex-1"
            >
              <div className="font-medium">{mission.title}</div>
              <div className="text-xs text-slate-500">
                {mission.worldId} · Age {mission.ageBand} · {mission.estimatedMinutes}min
              </div>
            </button>
            <button
              onClick={() => remove(mission.missionId)}
              className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Reactions Editor
// ============================================================================

function ReactionsEditor() {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [editing, setEditing] = useState<Reaction | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/data/reactions.json")
      .then((r) => r.json())
      .then(setReactions);
  }, []);

  const save = () => {
    if (!editing) return;
    const newReactions = isNew
      ? [...reactions, editing]
      : reactions.map((r) => (r.reactionId === editing.reactionId ? editing : r));
    setReactions(newReactions);
    downloadJson(newReactions, "reactions.json");
    setEditing(null);
    setIsNew(false);
  };

  const remove = (id: string) => {
    const newReactions = reactions.filter((r) => r.reactionId !== id);
    setReactions(newReactions);
    downloadJson(newReactions, "reactions.json");
  };

  if (editing) {
    return (
      <EditorForm
        title={isNew ? "New Reaction" : `Edit ${editing.reactionId}`}
        fields={[
          { key: "reactionId", label: "ID", type: "text" },
          { key: "equationDisplay", label: "Equation", type: "text" },
          { key: "ageBand", label: "Age Band", type: "select", options: ["6-7", "8-10", "11-14", "15-16"] },
          { key: "energyChangeLabel", label: "Energy", type: "select", options: ["exothermic", "endothermic", null as unknown as string] },
        ]}
        data={editing as unknown as Record<string, unknown>}
        onChange={(key, value) => {
          setEditing({ ...editing, [key]: value });
        }}
        onSave={save}
        onCancel={() => {
          setEditing(null);
          setIsNew(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">Reactions ({reactions.length})</h2>
        <button
          onClick={() => {
            setEditing({
              reactionId: "new_reaction",
              ageBand: "11-14",
              reactants: [],
              products: [],
              conditionTags: [],
              conservationSignature: {},
              equationDisplay: "",
              animationTemplate: null,
              energyChangeLabel: null,
              standardsTags: [],
            });
            setIsNew(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
      <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
        {reactions.map((reaction) => (
          <div
            key={reaction.reactionId}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-primary transition-colors"
          >
            <button
              onClick={() => {
                setEditing(reaction);
                setIsNew(false);
              }}
              className="text-left flex-1"
            >
              <div className="font-medium">{reaction.equationDisplay || reaction.reactionId}</div>
              <div className="text-xs text-slate-500">
                Age {reaction.ageBand} · {reaction.energyChangeLabel || "unknown energy"}
              </div>
            </button>
            <button
              onClick={() => remove(reaction.reactionId)}
              className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Generic Editor Form
// ============================================================================

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
}

function EditorForm({
  title,
  fields,
  data,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium mb-1">
              {field.label}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={(data[field.key] as string) ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
                rows={3}
              />
            ) : field.type === "select" ? (
              <select
                value={String(data[field.key] ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
              >
                {field.options?.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={String(data[field.key] ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-sky-200 outline-none"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Save className="w-4 h-4" />
          Save & Download
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-slate-300 font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
