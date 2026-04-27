"use client";

import { useEffect, useState } from "react";
import { useProgressStore } from "@/store/progressStore";
import AtomSpinner from "./AtomSpinner";

// Loads profiles once on app boot so that hard navigations and deep links
// can rehydrate `currentProfile` from localStorage. Placed at the layout
// level so every route benefits, not just the home page. Renders a spinner
// until the first profile load completes — otherwise gated routes (worlds,
// game, etc.) would observe `currentProfile === null` and bounce to home
// before rehydration finishes.
export default function ProfileBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const loadProfiles = useProgressStore((s) => s.loadProfiles);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    loadProfiles()
      .catch((err) => {
        console.error("Failed to bootstrap profiles:", err);
      })
      .finally(() => setBootstrapped(true));
  }, [loadProfiles]);

  if (!bootstrapped) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh">
        <AtomSpinner size={56} />
      </div>
    );
  }

  return <>{children}</>;
}
