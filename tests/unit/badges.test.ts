import { describe, expect, it } from "vitest";
import { evaluateBadges } from "@/engine/badges";
import type {
  BadgeDefinition,
  Mission,
  MissionProgress,
} from "@/types";

const m = (
  id: string,
  worldId: string,
  overrides: Partial<Mission> = {}
): Mission => ({
  missionId: id,
  worldId,
  title: id,
  brief: "",
  objectiveType: "build-atom",
  allowedElements: ["H"],
  allowedMolecules: [],
  successConditions: [
    { type: "build-atom", targetElement: "H", charge: 0 },
  ],
  hintSetId: "h",
  estimatedMinutes: 1,
  standardsTags: [],
  teacherNotes: "",
  difficulty: 1,
  ageBand: "8-10",
  prerequisites: [],
  ...overrides,
});

const p = (missionId: string, stars: number): MissionProgress => ({
  profileId: "p1",
  missionId,
  stars,
  completedAt: 1,
  attempts: 1,
  bestIndependenceScore: 1,
});

const baseCtx = {
  matchedMoleculeId: null,
  allDiscoveries: [],
  alreadyEarned: [],
};

describe("evaluateBadges", () => {
  it("awards first-mission-complete only on the first clear", () => {
    const def: BadgeDefinition = {
      badgeId: "first_steps",
      title: "",
      description: "",
      icon: "Sparkles",
      trigger: { kind: "first-mission-complete" },
    };
    const justCompleted = m("f01", "foundations");
    const earned = evaluateBadges([def], {
      ...baseCtx,
      justCompleted,
      starsEarned: 3,
      hintsUsed: 0,
      allProgress: [p("f01", 3)],
      allMissions: [justCompleted, m("f02", "foundations")],
    });
    expect(earned.map((b) => b.badgeId)).toEqual(["first_steps"]);

    // Already two missions complete -> not awarded.
    const earned2 = evaluateBadges([def], {
      ...baseCtx,
      justCompleted,
      starsEarned: 3,
      hintsUsed: 0,
      allProgress: [p("f01", 3), p("f02", 1)],
      allMissions: [justCompleted, m("f02", "foundations")],
    });
    expect(earned2).toHaveLength(0);
  });

  it("awards first-molecule when the matched molecule fires", () => {
    const def: BadgeDefinition = {
      badgeId: "water_maker",
      title: "",
      description: "",
      icon: "Droplets",
      trigger: { kind: "first-molecule", moleculeId: "water" },
    };
    const earned = evaluateBadges([def], {
      ...baseCtx,
      justCompleted: m("f02", "foundations"),
      starsEarned: 2,
      hintsUsed: 1,
      matchedMoleculeId: "water",
      allProgress: [p("f02", 2)],
      allMissions: [],
    });
    expect(earned.map((b) => b.badgeId)).toEqual(["water_maker"]);
  });

  it("awards complete-world only when every world mission has stars", () => {
    const def: BadgeDefinition = {
      badgeId: "foundations_finished",
      title: "",
      description: "",
      icon: "Award",
      trigger: { kind: "complete-world", worldId: "foundations" },
    };
    const missions = [
      m("f01", "foundations"),
      m("f02", "foundations"),
      m("c01", "core"),
    ];
    // Only one of two foundations missions cleared -> no award.
    const partial = evaluateBadges([def], {
      ...baseCtx,
      justCompleted: missions[0],
      starsEarned: 3,
      hintsUsed: 0,
      allProgress: [p("f01", 3)],
      allMissions: missions,
    });
    expect(partial).toHaveLength(0);

    const full = evaluateBadges([def], {
      ...baseCtx,
      justCompleted: missions[1],
      starsEarned: 3,
      hintsUsed: 0,
      allProgress: [p("f01", 3), p("f02", 1)],
      allMissions: missions,
    });
    expect(full.map((b) => b.badgeId)).toEqual(["foundations_finished"]);
  });

  it("awards no-hint-clear only when hintsUsed is zero", () => {
    const def: BadgeDefinition = {
      badgeId: "no_hint_clear",
      title: "",
      description: "",
      icon: "Lightbulb",
      trigger: { kind: "no-hint-clear" },
    };
    const justCompleted = m("f01", "foundations");
    const withHint = evaluateBadges([def], {
      ...baseCtx,
      justCompleted,
      starsEarned: 1,
      hintsUsed: 1,
      allProgress: [p("f01", 1)],
      allMissions: [justCompleted],
    });
    expect(withHint).toHaveLength(0);

    const noHint = evaluateBadges([def], {
      ...baseCtx,
      justCompleted,
      starsEarned: 2,
      hintsUsed: 0,
      allProgress: [p("f01", 2)],
      allMissions: [justCompleted],
    });
    expect(noHint.map((b) => b.badgeId)).toEqual(["no_hint_clear"]);
  });

  it("does not re-award badges already earned", () => {
    const def: BadgeDefinition = {
      badgeId: "first_steps",
      title: "",
      description: "",
      icon: "Sparkles",
      trigger: { kind: "first-mission-complete" },
    };
    const earned = evaluateBadges([def], {
      ...baseCtx,
      justCompleted: m("f01", "foundations"),
      starsEarned: 3,
      hintsUsed: 0,
      allProgress: [p("f01", 3)],
      allMissions: [m("f01", "foundations")],
      alreadyEarned: [
        { profileId: "p1", badgeId: "first_steps", earnedAt: 1 },
      ],
    });
    expect(earned).toHaveLength(0);
  });

  it("awards mission-count when threshold is reached", () => {
    const def: BadgeDefinition = {
      badgeId: "five_missions",
      title: "",
      description: "",
      icon: "TrendingUp",
      trigger: { kind: "mission-count", count: 5 },
    };
    const completed = [1, 2, 3, 4, 5].map((i) => p(`m${i}`, 2));
    const earned = evaluateBadges([def], {
      ...baseCtx,
      justCompleted: m("m5", "foundations"),
      starsEarned: 2,
      hintsUsed: 0,
      allProgress: completed,
      allMissions: completed.map((p) => m(p.missionId, "foundations")),
    });
    expect(earned.map((b) => b.badgeId)).toEqual(["five_missions"]);
  });
});
