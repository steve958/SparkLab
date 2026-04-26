import { create } from "zustand";
import type {
  SceneAtom,
  SceneBond,
  SceneState,
  UndoCommand,
  Mission,
  ScoreState,
  HintState,
  AttemptOutcome,
  HintAction,
} from "@/types";
import { createInitialScoreState } from "@/engine/scoring";
import { audio } from "@/lib/audio";

export interface GameStore {
  // Scene
  scene: SceneState;
  selectedAtomId: string | null;
  selectedBondId: string | null;
  hoveredAtomId: string | null;

  // Mission
  currentMission: Mission | null;
  scoreState: ScoreState;
  hintState: HintState;
  reactionMode: boolean;

  // History
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];

  // UI
  showHint: boolean;
  hintText: string;
  hintAction: HintAction | null;
  hintHighlightAtomIds: string[];
  showExplanation: boolean;
  explanationText: string;
  isMissionComplete: boolean;
  feedbackMessage: string | null;
  feedbackType: "success" | "error" | "info" | null;

  // Actions
  initMission: (mission: Mission, startingScene?: SceneState) => void;
  addAtom: (atom: SceneAtom) => void;
  removeAtom: (atomId: string) => void;
  moveAtom: (atomId: string, x: number, y: number) => void;
  addBond: (bond: SceneBond) => void;
  removeBond: (bondId: string) => void;
  setSelectedAtom: (atomId: string | null) => void;
  setSelectedBond: (bondId: string | null) => void;
  setHoveredAtom: (atomId: string | null) => void;
  undo: () => void;
  redo: () => void;
  useHint: (
    text: string,
    action?: HintAction,
    highlightAtomIds?: string[]
  ) => void;
  dismissHint: () => void;
  recordAttempt: (outcome: AttemptOutcome, detail?: string) => void;
  showFeedback: (message: string, type: "success" | "error" | "info") => void;
  dismissFeedback: () => void;
  completeMission: (stars: number, explanationCorrect: boolean | null) => void;
  dismissExplanation: () => void;
  resetScene: () => void;
}

function createEmptyScene(): SceneState {
  return {
    atoms: [],
    bonds: [],
    inventory: {},
  };
}

export const useGameStore = create<GameStore>((set) => ({
  scene: createEmptyScene(),
  selectedAtomId: null,
  selectedBondId: null,
  hoveredAtomId: null,
  currentMission: null,
  scoreState: createInitialScoreState(),
  hintState: {
    hintsUsed: 0,
    lastHintTier: 0,
    cooldownEnd: null,
    attempts: [],
  },
  reactionMode: false,
  undoStack: [],
  redoStack: [],
  showHint: false,
  hintText: "",
  hintAction: null,
  hintHighlightAtomIds: [],
  showExplanation: false,
  explanationText: "",
  isMissionComplete: false,
  feedbackMessage: null,
  feedbackType: null,

  initMission: (mission, startingScene) =>
    set({
      scene: startingScene ?? createEmptyScene(),
      currentMission: mission,
      scoreState: createInitialScoreState(),
      hintState: {
        hintsUsed: 0,
        lastHintTier: 0,
        cooldownEnd: null,
        attempts: [],
      },
      undoStack: [],
      redoStack: [],
      showHint: false,
      hintText: "",
      hintAction: null,
      hintHighlightAtomIds: [],
      showExplanation: false,
      explanationText: "",
      isMissionComplete: false,
      selectedAtomId: null,
      selectedBondId: null,
      hoveredAtomId: null,
      feedbackMessage: null,
      feedbackType: null,
      reactionMode: mission.objectiveType === "run-reaction",
    }),

  addAtom: (atom) =>
    set((state) => {
      audio.atomSpawn();
      const command: UndoCommand = {
        type: "add-atom",
        payload: atom,
        inverse: { id: atom.id },
      };
      return {
        scene: {
          ...state.scene,
          atoms: [...state.scene.atoms, atom],
        },
        undoStack: [...state.undoStack, command],
        redoStack: [],
      };
    }),

  removeAtom: (atomId) =>
    set((state) => {
      const atom = state.scene.atoms.find((a) => a.id === atomId);
      if (!atom) return state;

      const relatedBonds = state.scene.bonds.filter(
        (b) => b.atomAId === atomId || b.atomBId === atomId
      );
      const command: UndoCommand = {
        type: "remove-atom",
        payload: { id: atomId },
        inverse: { atom, bonds: relatedBonds },
      };

      return {
        scene: {
          ...state.scene,
          atoms: state.scene.atoms.filter((a) => a.id !== atomId),
          bonds: state.scene.bonds.filter(
            (b) => b.atomAId !== atomId && b.atomBId !== atomId
          ),
        },
        selectedAtomId:
          state.selectedAtomId === atomId ? null : state.selectedAtomId,
        undoStack: [...state.undoStack, command],
        redoStack: [],
      };
    }),

  moveAtom: (atomId, x, y) =>
    set((state) => {
      const atom = state.scene.atoms.find((a) => a.id === atomId);
      if (!atom) return state;

      const prevX = atom.x;
      const prevY = atom.y;
      const command: UndoCommand = {
        type: "move-atom",
        payload: { id: atomId, x, y },
        inverse: { id: atomId, x: prevX, y: prevY },
      };

      return {
        scene: {
          ...state.scene,
          atoms: state.scene.atoms.map((a) =>
            a.id === atomId ? { ...a, x, y } : a
          ),
        },
        undoStack: [...state.undoStack, command],
        redoStack: [],
      };
    }),

  addBond: (bond) =>
    set((state) => {
      // Prevent duplicate bonds
      const exists = state.scene.bonds.some(
        (b) =>
          (b.atomAId === bond.atomAId && b.atomBId === bond.atomBId) ||
          (b.atomAId === bond.atomBId && b.atomBId === bond.atomAId)
      );
      if (exists) return state;

      if (bond.bondType === "ionic") {
        audio.bondIonic();
      } else {
        audio.bondForm();
      }

      const command: UndoCommand = {
        type: "add-bond",
        payload: bond,
        inverse: { id: bond.id },
      };

      return {
        scene: {
          ...state.scene,
          bonds: [...state.scene.bonds, bond],
        },
        undoStack: [...state.undoStack, command],
        redoStack: [],
      };
    }),

  removeBond: (bondId) =>
    set((state) => {
      const bond = state.scene.bonds.find((b) => b.id === bondId);
      if (!bond) return state;

      const command: UndoCommand = {
        type: "remove-bond",
        payload: { id: bondId },
        inverse: bond,
      };

      return {
        scene: {
          ...state.scene,
          bonds: state.scene.bonds.filter((b) => b.id !== bondId),
        },
        selectedBondId:
          state.selectedBondId === bondId ? null : state.selectedBondId,
        undoStack: [...state.undoStack, command],
        redoStack: [],
      };
    }),

  // Atom and bond selection are mutually exclusive in the UI: selecting one
  // clears the other so the HUD/keyboard always have a single target.
  setSelectedAtom: (atomId) =>
    set((state) => ({
      selectedAtomId: atomId,
      selectedBondId: atomId !== null ? null : state.selectedBondId,
    })),
  setSelectedBond: (bondId) =>
    set((state) => ({
      selectedBondId: bondId,
      selectedAtomId: bondId !== null ? null : state.selectedAtomId,
    })),
  setHoveredAtom: (atomId) => set({ hoveredAtomId: atomId }),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const [lastCommand, ...remaining] = [...state.undoStack].reverse();
      const newRedoStack = [lastCommand, ...state.redoStack];

      // Apply inverse
      let newScene = state.scene;
      switch (lastCommand.type) {
        case "add-atom":
          newScene = {
            ...state.scene,
            atoms: state.scene.atoms.filter(
              (a) => a.id !== (lastCommand.inverse as { id: string }).id
            ),
          };
          break;
        case "remove-atom": {
          const inv = lastCommand.inverse as {
            atom: SceneAtom;
            bonds: SceneBond[];
          };
          newScene = {
            ...state.scene,
            atoms: [...state.scene.atoms, inv.atom],
            bonds: [...state.scene.bonds, ...inv.bonds],
          };
          break;
        }
        case "move-atom": {
          const inv = lastCommand.inverse as { id: string; x: number; y: number };
          newScene = {
            ...state.scene,
            atoms: state.scene.atoms.map((a) =>
              a.id === inv.id ? { ...a, x: inv.x, y: inv.y } : a
            ),
          };
          break;
        }
        case "add-bond":
          newScene = {
            ...state.scene,
            bonds: state.scene.bonds.filter(
              (b) => b.id !== (lastCommand.inverse as { id: string }).id
            ),
          };
          break;
        case "remove-bond":
          newScene = {
            ...state.scene,
            bonds: [...state.scene.bonds, lastCommand.inverse as SceneBond],
          };
          break;
      }

      return {
        scene: newScene,
        undoStack: remaining.reverse(),
        redoStack: newRedoStack,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const [nextCommand, ...remaining] = state.redoStack;
      const newUndoStack = [...state.undoStack, nextCommand];

      // Re-apply command
      let newScene = state.scene;
      switch (nextCommand.type) {
        case "add-atom":
          newScene = {
            ...state.scene,
            atoms: [...state.scene.atoms, nextCommand.payload as SceneAtom],
          };
          break;
        case "remove-atom": {
          const payload = nextCommand.payload as { id: string };
          const atom = state.scene.atoms.find((a) => a.id === payload.id);
          if (atom) {
            newScene = {
              ...state.scene,
              atoms: state.scene.atoms.filter((a) => a.id !== payload.id),
              bonds: state.scene.bonds.filter(
                (b) => b.atomAId !== payload.id && b.atomBId !== payload.id
              ),
            };
          }
          break;
        }
        case "move-atom": {
          const payload = nextCommand.payload as {
            id: string;
            x: number;
            y: number;
          };
          newScene = {
            ...state.scene,
            atoms: state.scene.atoms.map((a) =>
              a.id === payload.id ? { ...a, x: payload.x, y: payload.y } : a
            ),
          };
          break;
        }
        case "add-bond":
          newScene = {
            ...state.scene,
            bonds: [...state.scene.bonds, nextCommand.payload as SceneBond],
          };
          break;
        case "remove-bond": {
          const payload = nextCommand.payload as { id: string };
          newScene = {
            ...state.scene,
            bonds: state.scene.bonds.filter((b) => b.id !== payload.id),
          };
          break;
        }
      }

      return {
        scene: newScene,
        undoStack: newUndoStack,
        redoStack: remaining,
      };
    }),

  useHint: (text, action, highlightAtomIds) =>
    set((state) => ({
      showHint: true,
      hintText: text,
      hintAction: action ?? null,
      hintHighlightAtomIds: highlightAtomIds ?? [],
      hintState: {
        ...state.hintState,
        hintsUsed: state.hintState.hintsUsed + 1,
        lastHintTier: state.hintState.hintsUsed,
      },
    })),

  dismissHint: () =>
    set({ showHint: false, hintAction: null, hintHighlightAtomIds: [] }),

  recordAttempt: (outcome, detail) =>
    set((state) => ({
      hintState: {
        ...state.hintState,
        attempts: [
          ...state.hintState.attempts,
          { timestamp: Date.now(), outcome, detail },
        ],
      },
    })),

  showFeedback: (message, type) => {
    if (type === "error") {
      audio.invalidAction();
      window.dispatchEvent(new CustomEvent("sparklab-invalid-action"));
    }
    set({ feedbackMessage: message, feedbackType: type });
  },

  dismissFeedback: () => set({ feedbackMessage: null, feedbackType: null }),

  completeMission: (stars, explanationCorrect) => {
    audio.missionComplete();
    for (let i = 0; i < stars; i++) {
      setTimeout(() => audio.starAward(), i * 200);
    }
    set((state) => ({
      isMissionComplete: true,
      scoreState: {
        ...state.scoreState,
        stars,
        correctness: true,
        explanationCorrect,
        endTime: Date.now(),
      },
    }));
  },

  dismissExplanation: () => set({ showExplanation: false }),

  resetScene: () =>
    set(() => ({
      scene: createEmptyScene(),
      undoStack: [],
      redoStack: [],
      selectedAtomId: null,
      selectedBondId: null,
      isMissionComplete: false,
      scoreState: createInitialScoreState(),
    })),
}));
