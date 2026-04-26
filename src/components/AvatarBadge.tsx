"use client";

import {
  Sparkles,
  Atom,
  FlaskConical,
  FlaskRound,
  Microscope,
  Lightbulb,
  Star,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { PlayerProfile } from "@/types";

// Curated palette and accessory set. The AvatarBuilder picks from these.
// Both lists must stay in sync between the badge renderer and the
// builder so a saved value always renders predictably.
export const AVATAR_PALETTE = [
  "#15803d", // brand green-700
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#0ea5e9", // sky-500
  "#64748b", // slate-500
] as const;

export const AVATAR_ACCESSORIES: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  atom: Atom,
  flask: FlaskConical,
  flaskRound: FlaskRound,
  microscope: Microscope,
  lightbulb: Lightbulb,
  star: Star,
  wand: Wand2,
};

export const DEFAULT_AVATAR_COLOR = AVATAR_PALETTE[0];
export const DEFAULT_AVATAR_ACCESSORY = "sparkles";

interface AvatarBadgeProps {
  profile: Pick<PlayerProfile, "name" | "avatarColor" | "avatarAccessory">;
  // sm = 32px, md = 40px, lg = 56px, xl = 80px
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: { box: "w-8 h-8", text: "text-sm", accessory: "w-3 h-3", badge: "w-3 h-3" },
  md: { box: "w-10 h-10", text: "text-base", accessory: "w-3.5 h-3.5", badge: "w-3.5 h-3.5" },
  lg: { box: "w-14 h-14", text: "text-xl", accessory: "w-4 h-4", badge: "w-5 h-5" },
  xl: { box: "w-20 h-20", text: "text-3xl", accessory: "w-5 h-5", badge: "w-6 h-6" },
};

export default function AvatarBadge({
  profile,
  size = "md",
  className = "",
}: AvatarBadgeProps) {
  const color = profile.avatarColor ?? DEFAULT_AVATAR_COLOR;
  const accessoryKey = profile.avatarAccessory ?? DEFAULT_AVATAR_ACCESSORY;
  const Accessory = AVATAR_ACCESSORIES[accessoryKey] ?? Sparkles;
  const sz = SIZE_MAP[size];
  const initial = profile.name.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`relative ${sz.box} rounded-full text-white flex items-center justify-center font-bold ${sz.text} shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <span>{initial}</span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 ${sz.badge} rounded-full bg-white text-slate-700 flex items-center justify-center shadow-sm`}
      >
        <Accessory className={sz.accessory} />
      </span>
    </div>
  );
}
