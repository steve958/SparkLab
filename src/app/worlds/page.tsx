"use client";

import { Suspense } from "react";
import WorldsPageContent from "./WorldsPageContent";

export default function WorldsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-dvh">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <WorldsPageContent />
    </Suspense>
  );
}
