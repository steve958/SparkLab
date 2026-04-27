"use client";

import { useProgressStore } from "@/store/progressStore";
import ProfileSelector from "@/components/ProfileSelector";
import LabHub from "@/components/LabHub";
import OnboardingIntro from "@/components/OnboardingIntro";
import AmbientAtoms from "@/components/AmbientAtoms";

export default function Home() {
  const currentProfile = useProgressStore((s) => s.currentProfile);

  // First-run players see the onboarding intro instead of the lab hub.
  // Older profiles created before the field existed default to undefined,
  // which we treat as already-onboarded so returning users aren't pestered.
  const needsOnboarding =
    currentProfile && currentProfile.onboardingCompleted === false;

  return (
    // relative + overflow-hidden so the AmbientAtoms layer can fill
    // this main without bleeding into the body. The actual content
    // wrapper sits at z-10 to stack above the ambient layer.
    <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <AmbientAtoms count={14} seed={71} />
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {!currentProfile ? (
          <ProfileSelector />
        ) : needsOnboarding ? (
          <OnboardingIntro />
        ) : (
          <LabHub />
        )}
      </div>
    </main>
  );
}
