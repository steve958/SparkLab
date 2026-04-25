import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/store/gameStore";
import type { Mission, SceneAtom, SceneBond } from "@/types";

// Audio synthesis is irrelevant to state-machine semantics and tries to touch
// the Web Audio API; stub it out at module load time.
vi.mock("@/lib/audio", () => ({
  audio: {
    atomSpawn: vi.fn(),
    bondForm: vi.fn(),
    bondIonic: vi.fn(),
    invalidAction: vi.fn(),
    missionComplete: vi.fn(),
    starAward: vi.fn(),
    uiClick: vi.fn(),
    uiHover: vi.fn(),
    setEnabled: vi.fn(),
    setReducedMotion: vi.fn(),
  },
}));

const mission: Mission = {
  missionId: "m1",
  worldId: "w1",
  title: "Test mission",
  brief: "",
  objectiveType: "build-molecule",
  allowedElements: ["H", "O"],
  allowedMolecules: ["water"],
  successConditions: [{ type: "build-molecule", targetMoleculeId: "water" }],
  hintSetId: "h1",
  estimatedMinutes: 1,
  standardsTags: [],
  teacherNotes: "",
  difficulty: 1,
  ageBand: "8-10",
  prerequisites: [],
};

const reactionMission: Mission = { ...mission, objectiveType: "run-reaction" };

function atom(id: string, overrides: Partial<SceneAtom> = {}): SceneAtom {
  return {
    id,
    elementId: "H",
    x: 0,
    y: 0,
    protons: 1,
    neutrons: 0,
    electrons: 1,
    ...overrides,
  };
}

function bond(id: string, a: string, b: string): SceneBond {
  return { id, atomAId: a, atomBId: b, bondType: "covalent-single" };
}

describe("gameStore", () => {
  beforeEach(() => {
    // Re-init mission so every test gets a clean slate (also clears scene & history).
    useGameStore.getState().initMission(mission);
  });

  it("initMission resets scene, score, and history", () => {
    const s1 = useGameStore.getState();
    s1.addAtom(atom("a1"));
    s1.addBond(bond("b1", "a1", "a1"));
    expect(useGameStore.getState().scene.atoms).toHaveLength(1);
    expect(useGameStore.getState().undoStack.length).toBeGreaterThan(0);

    useGameStore.getState().initMission(mission);

    const s2 = useGameStore.getState();
    expect(s2.scene.atoms).toEqual([]);
    expect(s2.scene.bonds).toEqual([]);
    expect(s2.undoStack).toEqual([]);
    expect(s2.redoStack).toEqual([]);
    expect(s2.selectedAtomId).toBeNull();
    expect(s2.isMissionComplete).toBe(false);
  });

  it("initMission flips reactionMode for run-reaction missions", () => {
    useGameStore.getState().initMission(reactionMission);
    expect(useGameStore.getState().reactionMode).toBe(true);

    useGameStore.getState().initMission(mission);
    expect(useGameStore.getState().reactionMode).toBe(false);
  });

  it("addAtom records an undo command and clears the redo stack", () => {
    const a1 = atom("a1");
    useGameStore.getState().addAtom(a1);

    let s = useGameStore.getState();
    expect(s.scene.atoms).toEqual([a1]);
    expect(s.undoStack).toHaveLength(1);
    expect(s.undoStack[0].type).toBe("add-atom");
    expect(s.redoStack).toEqual([]);

    s.undo();
    s = useGameStore.getState();
    expect(s.redoStack).toHaveLength(1);

    // A new mutation must drop the redo stack.
    useGameStore.getState().addAtom(atom("a2"));
    expect(useGameStore.getState().redoStack).toEqual([]);
  });

  it("removeAtom cascades bond removal and is reversible via undo", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.addAtom(atom("a2"));
    s.addBond(bond("b1", "a1", "a2"));

    s.removeAtom("a1");
    let post = useGameStore.getState();
    expect(post.scene.atoms.map((a) => a.id)).toEqual(["a2"]);
    expect(post.scene.bonds).toEqual([]);

    post.undo();
    post = useGameStore.getState();
    expect(post.scene.atoms.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
    expect(post.scene.bonds.map((b) => b.id)).toEqual(["b1"]);
  });

  it("removeAtom clears selection if the deleted atom was selected", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.setSelectedAtom("a1");
    s.removeAtom("a1");
    expect(useGameStore.getState().selectedAtomId).toBeNull();
  });

  it("moveAtom undo restores the previous coordinates", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1", { x: 10, y: 20 }));
    s.moveAtom("a1", 100, 200);
    expect(useGameStore.getState().scene.atoms[0]).toMatchObject({ x: 100, y: 200 });

    useGameStore.getState().undo();
    expect(useGameStore.getState().scene.atoms[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("addBond is idempotent for the same atom pair regardless of order", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.addAtom(atom("a2"));
    s.addBond(bond("b1", "a1", "a2"));
    s.addBond(bond("b2", "a2", "a1"));
    expect(useGameStore.getState().scene.bonds).toHaveLength(1);
  });

  it("undo then redo round-trips an add-bond", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.addAtom(atom("a2"));
    s.addBond(bond("b1", "a1", "a2"));

    s.undo();
    expect(useGameStore.getState().scene.bonds).toEqual([]);

    useGameStore.getState().redo();
    expect(useGameStore.getState().scene.bonds.map((b) => b.id)).toEqual(["b1"]);
  });

  it("undo on an empty stack is a no-op", () => {
    const before = useGameStore.getState().scene;
    useGameStore.getState().undo();
    expect(useGameStore.getState().scene).toBe(before);
  });

  it("resetScene wipes scene and history but keeps mission", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.resetScene();
    const after = useGameStore.getState();
    expect(after.scene.atoms).toEqual([]);
    expect(after.undoStack).toEqual([]);
    expect(after.currentMission?.missionId).toBe(mission.missionId);
  });

  it("selecting an atom clears any bond selection (and vice versa)", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.addAtom(atom("a2"));
    s.addBond(bond("b1", "a1", "a2"));

    s.setSelectedBond("b1");
    expect(useGameStore.getState().selectedBondId).toBe("b1");
    expect(useGameStore.getState().selectedAtomId).toBeNull();

    s.setSelectedAtom("a1");
    let st = useGameStore.getState();
    expect(st.selectedAtomId).toBe("a1");
    expect(st.selectedBondId).toBeNull();

    s.setSelectedBond("b1");
    st = useGameStore.getState();
    expect(st.selectedBondId).toBe("b1");
    expect(st.selectedAtomId).toBeNull();
  });

  it("removeBond clears the bond selection if the deleted bond was selected", () => {
    const s = useGameStore.getState();
    s.addAtom(atom("a1"));
    s.addAtom(atom("a2"));
    s.addBond(bond("b1", "a1", "a2"));
    s.setSelectedBond("b1");

    s.removeBond("b1");
    expect(useGameStore.getState().selectedBondId).toBeNull();
  });
});
