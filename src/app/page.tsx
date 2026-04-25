"use client";

import { useEffect, useState } from "react";
import { useProgressStore } from "@/store/progressStore";
import ProfileSelector from "@/components/ProfileSelector";
import MainMenu from "@/components/MainMenu";

export default function Home() {
  const currentProfile = useProgressStore((s) => s.currentProfile);
  const loadProfiles = useProgressStore((s) => s.loadProfiles);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadProfiles()
      .then(() => setLoaded(true))
      .catch((err) => {
        console.error("Failed to load profiles:", err);
        setLoaded(true);
      });
  }, [loadProfiles]);

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">Loading SparkLab...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      {currentProfile ? <MainMenu /> : <ProfileSelector />}
    </main>
  );
}
