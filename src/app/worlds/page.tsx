"use client";

import { Suspense } from "react";
import WorldsPageContent from "./WorldsPageContent";
import AtomSpinner from "@/components/AtomSpinner";

export default function WorldsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-dvh">
          <AtomSpinner size={56} />
        </div>
      }
    >
      <WorldsPageContent />
    </Suspense>
  );
}
