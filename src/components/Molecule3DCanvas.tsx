"use client";

import { useEffect, useRef } from "react";
import type { Molecule, Element } from "@/types";

interface Molecule3DCanvasProps {
  molecule: Molecule;
  elements: Element[];
  width?: number;
  height?: number;
}

// Ballpark 3D geometries for common molecules (angstroms)
const PRESET_COORDS: Record<string, [number, number, number][]> = {
  water: [
    [0, 0, 0],
    [0.96, 0, 0],
    [-0.24, 0.93, 0],
  ],
  carbon_dioxide: [
    [0, 0, 0],
    [1.16, 0, 0],
    [-1.16, 0, 0],
  ],
  methane: [
    [0, 0, 0],
    [0.63, 0.63, 0.63],
    [0.63, -0.63, -0.63],
    [-0.63, 0.63, -0.63],
    [-0.63, -0.63, 0.63],
  ],
  ammonia: [
    [0, 0, 0],
    [0, 0, 1.01],
    [0.95, 0, -0.33],
    [-0.48, 0.82, -0.33],
  ],
  oxygen_gas: [
    [0, 0, 0],
    [1.21, 0, 0],
  ],
  nitrogen_gas: [
    [0, 0, 0],
    [1.10, 0, 0],
  ],
  hydrogen_gas: [
    [0, 0, 0],
    [0.74, 0, 0],
  ],
  hydrogen_chloride: [
    [0, 0, 0],
    [1.27, 0, 0],
  ],
  sodium_chloride: [
    [0, 0, 0],
    [2.36, 0, 0],
  ],
  chlorine_gas: [
    [0, 0, 0],
    [1.99, 0, 0],
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Viewer3D = any;

export default function Molecule3DCanvas({
  molecule,
  width = 400,
  height = 300,
}: Molecule3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let viewer: Viewer3D | null = null;

    async function init() {
      const mod = await import("3dmol");
      if (destroyed) return;

      const createViewer =
        mod.createViewer ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((mod as unknown as Record<string, any>).default?.createViewer);

      if (typeof createViewer !== "function") {
        console.error("3Dmol createViewer not found");
        return;
      }

      viewer = createViewer(container, { backgroundColor: "white" });
      if (!viewer || destroyed) return;

      // Build XYZ format string
      const coords = PRESET_COORDS[molecule.moleculeId];
      const lines: string[] = [];
      lines.push(String(molecule.allowedBondGraph.nodes.length));
      lines.push(molecule.displayName);

      for (let i = 0; i < molecule.allowedBondGraph.nodes.length; i++) {
        const node = molecule.allowedBondGraph.nodes[i];
        const c = coords?.[i] || [i * 1.8, 0, 0];
        lines.push(
          `${node.elementId}  ${c[0].toFixed(3)}  ${c[1].toFixed(3)}  ${c[2].toFixed(3)}`
        );
      }

      const xyzData = lines.join("\n");
      viewer.addModel(xyzData, "xyz");

      // Ball-and-stick style with element colors
      viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.3 } });

      viewer.zoomTo();
      viewer.render();

      // Default y-axis spin so the player sees the 3D shape
      // without having to click-drag to rotate it. Skipped for
      // reduced-motion users — they get the same static
      // ball-and-stick render desktop chemistry textbooks use.
      // The 3dmol API is `spin(axis, speed)`; speed is a multiplier
      // of the default rate, 0.5 is a gentle slow turn that lets
      // the geometry register without feeling busy. Wrapped in try
      // so an older bundle without the spin method just no-ops.
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion && typeof viewer.spin === "function") {
        try {
          viewer.spin("y", 0.5);
        } catch {
          // Older 3dmol versions might not support the speed arg.
          try {
            viewer.spin("y");
          } catch {
            // No spin available — fall back to the static render.
          }
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      if (viewer) {
        // Stop auto-rotation before tearing the viewer down so the
        // RAF loop the spin runs on doesn't try to render against a
        // destroyed canvas.
        if (typeof viewer.spin === "function") {
          try {
            viewer.spin(false);
          } catch {
            // ignore — viewer may already be torn down
          }
        }
        viewer.removeAllModels();
        viewer.removeAllLabels();
        viewer.removeAllSurfaces();
        if (typeof viewer.destroy === "function") {
          viewer.destroy();
        }
      }
      if (container) container.innerHTML = "";
    };
  }, [molecule]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, position: "relative" }}
      className="rounded-xl overflow-hidden border border-slate-200 bg-white"
    />
  );
}
