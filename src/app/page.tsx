"use client";

import { useProgressStore } from "@/store/progressStore";
import ProfileSelector from "@/components/ProfileSelector";
import LabHub from "@/components/LabHub";
import OnboardingIntro from "@/components/OnboardingIntro";

export default function Home() {
  const currentProfile = useProgressStore((s) => s.currentProfile);

  // First-run players see the onboarding intro instead of the lab hub.
  // Older profiles created before the field existed default to undefined,
  // which we treat as already-onboarded so returning users aren't pestered.
  const needsOnboarding =
    currentProfile && currentProfile.onboardingCompleted === false;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      {!currentProfile ? (
        <ProfileSelector />
      ) : needsOnboarding ? (
        <OnboardingIntro />
      ) : (
        <LabHub />
      )}
    </main>
  );
}
