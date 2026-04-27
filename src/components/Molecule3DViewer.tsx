"use client";

import { Suspense, lazy } from "react";
import type { Molecule, Element } from "@/types";
import AtomSpinner from "./AtomSpinner";

const Molecule3DCanvas = lazy(() => import("./Molecule3DCanvas"));

interface Molecule3DViewerProps {
  molecule: Molecule;
  elements: Element[];
  width?: number;
  height?: number;
}

export default function Molecule3DViewer(props: Molecule3DViewerProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200"
          style={{ width: props.width ?? 400, height: props.height ?? 300 }}
        >
          <AtomSpinner size={40} />
        </div>
      }
    >
      <Molecule3DCanvas {...props} />
    </Suspense>
  );
}
