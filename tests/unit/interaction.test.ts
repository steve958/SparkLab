import { describe, it, expect } from "vitest";
import {
  nudgePosition,
  findNearestAtom,
  shouldTapBond,
  isTapGesture,
} from "@/engine/interaction";
import type { SceneAtom } from "@/types";

describe("Interaction Engine", () => {
  describe("nudgePosition", () => {
    it("nudges up", () => {
      expect(nudgePosition(100, 100, "ArrowUp", 10)).toEqual({ x: 100, y: 90 });
    });

    it("nudges down", () => {
      expect(nudgePosition(100, 100, "ArrowDown", 10)).toEqual({ x: 100, y: 110 });
    });

    it("nudges left", () => {
      expect(nudgePosition(100, 100, "ArrowLeft", 10)).toEqual({ x: 90, y: 100 });
    });

    it("nudges right", () => {
      expect(nudgePosition(100, 100, "ArrowRight", 10)).toEqual({ x: 110, y: 100 });
    });

    it("uses custom step size", () => {
      expect(nudgePosition(0, 0, "ArrowRight", 25)).toEqual({ x: 25, y: 0 });
    });
  });

  describe("findNearestAtom", () => {
    const atoms: SceneAtom[] = [
      { id: "a1", elementId: "H", x: 0, y: 0, protons: 1, neutrons: 0, electrons: 1 },
      { id: "a2", elementId: "O", x: 50, y: 0, protons: 8, neutrons: 8, electrons: 8 },
      { id: "a3", elementId: "H", x: 200, y: 0, protons: 1, neutrons: 0, electrons: 1 },
    ];

    it("finds the nearest atom within range", () => {
      const selected = atoms[0];
      const nearest = findNearestAtom(selected, atoms, 150);
      expect(nearest).not.toBeNull();
      expect(nearest!.id).toBe("a2");
    });

    it("returns null when no atoms are within range", () => {
      const selected = atoms[0];
      const nearest = findNearestAtom(selected, atoms, 10);
      expect(nearest).toBeNull();
    });

    it("excludes the selected atom itself", () => {
      const selected = atoms[1];
      const nearest = findNearestAtom(selected, atoms, 150);
      expect(nearest).not.toBeNull();
      expect(nearest!.id).not.toBe("a2");
    });

    it("returns null for a single atom", () => {
      const selected = atoms[0];
      const nearest = findNearestAtom(selected, [selected], 150);
      expect(nearest).toBeNull();
    });
  });

  describe("shouldTapBond", () => {
    it("bonds when different atoms are selected and tapped", () => {
      expect(shouldTapBond("a1", "a2")).toBe(true);
    });

    it("does not bond when tapping the already-selected atom", () => {
      expect(shouldTapBond("a1", "a1")).toBe(false);
    });

    it("does not bond when nothing is selected", () => {
      expect(shouldTapBond(null, "a1")).toBe(false);
    });
  });

  describe("isTapGesture", () => {
    it("returns true for a short press with no movement", () => {
      expect(isTapGesture(100, 100, 100, 100, 150)).toBe(true);
    });

    it("returns false for significant movement", () => {
      expect(isTapGesture(100, 100, 120, 100, 150)).toBe(false);
    });

    it("returns false for a long press", () => {
      expect(isTapGesture(100, 100, 100, 100, 500)).toBe(false);
    });

    it("allows small movement within threshold", () => {
      expect(isTapGesture(100, 100, 103, 103, 150, 5)).toBe(true);
    });
  });
});
