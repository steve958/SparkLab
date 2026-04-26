import type {
  BadgeDefinition,
  BadgeAward,
  Mission,
  MissionProgress,
  Discovery,
} from "@/types";

export interface BadgeEvalContext {
  // The mission that was just completed (or null if the trigger isn't
  // mission-related).
  justCompleted: Mission | null;
  // Stars awarded on the just-completed mission.
  starsEarned: number;
  // Hints used during the just-completed mission.
  hintsUsed: number;
  // The molecule the player just built (or matched), if any.
  matchedMoleculeId: string | null;
  // Full mission progress for the active profile.
  allProgress: MissionProgress[];
  // All authored missions (so we can resolve world membership).
  allMissions: Mission[];
  // The full discovery history for the player (used for "elements-
  // discovered" trigger).
  allDiscoveries: Discovery[];
  // Badges already earned, so we don't re-award.
  alreadyEarned: BadgeAward[];
}

/**
 * Run every badge definition against the post-event state and return the
 * subset that the player has just earned. Pure function: caller persists
 * the results.
 */
export function evaluateBadges(
  defs: BadgeDefinition[],
  ctx: BadgeEvalContext
): BadgeDefinition[] {
  const earnedIds = new Set(ctx.alreadyEarned.map((a) => a.badgeId));
  return defs.filter((def) => {
    if (earnedIds.has(def.badgeId)) return false;
    return triggerSatisfied(def, ctx);
  });
}

function triggerSatisfied(def: BadgeDefinition, ctx: BadgeEvalContext): boolean {
  const completedCount = ctx.allProgress.filter((p) => p.stars > 0).length;
  switch (def.trigger.kind) {
    case "first-mission-complete":
      // Awarded only on the very first mission completion. completedCount
      // includes the mission that just finalized.
      return completedCount === 1 && !!ctx.justCompleted;

    case "first-molecule":
      return ctx.matchedMoleculeId === def.trigger.moleculeId;

    case "complete-world": {
      const worldId = def.trigger.worldId;
      const worldMissions = ctx.allMissions.filter(
        (m) => m.worldId === worldId
      );
      if (worldMissions.length === 0) return false;
      return worldMissions.every((m) => {
        const p = ctx.allProgress.find((rec) => rec.missionId === m.missionId);
        return !!p && p.stars > 0;
      });
    }

    case "no-hint-clear": {
      if (!ctx.justCompleted || ctx.starsEarned === 0) return false;
      const required = def.trigger.missionId;
      if (required && ctx.justCompleted.missionId !== required) return false;
      return ctx.hintsUsed === 0;
    }

    case "perfect-mission": {
      if (!ctx.justCompleted || ctx.starsEarned < 3) return false;
      const required = def.trigger.missionId;
      if (required && ctx.justCompleted.missionId !== required) return false;
      return true;
    }

    case "mission-count":
      return completedCount >= def.trigger.count;

    case "elements-discovered": {
      // Count distinct elements the player has built atoms of via mission
      // progress. We approximate from missions whose successConditions
      // touched a specific target element.
      const elements = new Set<string>();
      for (const p of ctx.allProgress) {
        if (p.stars <= 0) continue;
        const m = ctx.allMissions.find((mm) => mm.missionId === p.missionId);
        if (!m) continue;
        for (const cond of m.successConditions) {
          if (cond.type === "build-atom") elements.add(cond.targetElement);
          if (cond.type === "count-atoms") elements.add(cond.element);
        }
        for (const el of m.allowedElements) elements.add(el);
      }
      return elements.size >= def.trigger.count;
    }
  }
}
