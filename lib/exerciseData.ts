// lib/exerciseData.ts
// Shared baseline exercise data — the single source of truth for exercise chains.
//
// ARCHITECTURE:
//   Free tier  (generatePlanSimple) → imports chain arrays + builds a simple string
//                                     prompt from the names. No skill tree logic.
//   Pro tier   (generatePlanAI)     → imports chain arrays for progression resolution
//                                     + imports skillTree for full graph context.
//
// Both tiers reference the same chain definitions here so they never drift apart.

import type { EquipmentTag } from "./skillTree";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseEntry {
  id:        string;           // matches NODE_MAP node ID where applicable
  name:      string;           // display name sent to Gemini / shown in UI
  equipment: EquipmentTag[];   // empty = bodyweight only
}

export interface ExerciseChain {
  label:     string;           // movement pattern label
  session:   "pull" | "push" | "legs" | "core"; // which session type it belongs to
  exercises: ExerciseEntry[];  // easiest → hardest
}

// ─── Workout chains ───────────────────────────────────────────────────────────
// These are the main session exercise progressions.
// Order is easiest → hardest within each pattern.

export const WORKOUT_CHAINS: ExerciseChain[] = [
  {
    label: "Vertical Pull", session: "pull",
    exercises: [
      { id: "dead-hang",        name: "Dead hang",                       equipment: [] },
      { id: "active-hang",      name: "Active / scapular hang",          equipment: [] },
      { id: "pullup-negative",  name: "Pull-up negative",                equipment: [] },
      { id: "banded-pullup",    name: "Banded pull-up",                  equipment: ["bands"] },
      { id: "pullup",           name: "Pull-up",                         equipment: ["bar"] },
      { id: "explosive-pullup", name: "Explosive pull-up",               equipment: ["bar"] },
      { id: "weighted-pullup",  name: "Weighted pull-up",                equipment: ["bar", "weights"] },
      { id: "archer-pullup",    name: "Archer pull-up",                  equipment: ["bar"] },
    ],
  },
  {
    label: "Horizontal Pull", session: "pull",
    exercises: [
      { id: "row-bent-legs",     name: "Inverted row — bent legs",       equipment: [] },
      { id: "row-straight-legs", name: "Inverted row — straight legs",   equipment: [] },
      { id: "row-elevated-legs", name: "Inverted row — elevated legs",   equipment: [] },
      { id: "ring-row",          name: "Ring row",                       equipment: ["rings"] },
      { id: "weighted-row",      name: "Weighted row",                   equipment: ["weights"] },
    ],
  },
  {
    label: "Chin-up", session: "pull",
    exercises: [
      { id: "chinup-negative",  name: "Chin-up negative",                equipment: [] },
      { id: "banded-chinup",    name: "Banded chin-up",                  equipment: ["bands"] },
      { id: "chinup",           name: "Chin-up",                         equipment: [] },
      { id: "explosive-chinup", name: "Explosive chin-up",               equipment: [] },
    ],
  },
  {
    label: "Vertical Push", session: "push",
    exercises: [
      { id: "elevated-pike-pu",    name: "Elevated pike push-up",        equipment: [] },
      { id: "pike-pu",             name: "Pike push-up",                 equipment: [] },
      { id: "decline-pike-pu",     name: "Decline pike push-up",         equipment: [] },
      { id: "decline-pike-parall", name: "Decline pike — parallettes",   equipment: ["parallettes"] },
      { id: "wall-assisted-hspu",  name: "Wall assisted HSPU",           equipment: [] },
      { id: "hspu",                name: "Handstand push-up",            equipment: [] },
    ],
  },
  {
    label: "Horizontal Push", session: "push",
    exercises: [
      { id: "incline-knee-pu", name: "Incline knee push-up",             equipment: [] },
      { id: "knee-pu",         name: "Knee push-up",                     equipment: [] },
      { id: "incline-pu",      name: "Incline push-up",                  equipment: [] },
      { id: "standard-pu",     name: "Standard push-up",                 equipment: [] },
      { id: "explosive-pu",    name: "Explosive push-up",                equipment: [] },
      { id: "diamond-pu",      name: "Diamond push-up",                  equipment: [] },
      { id: "decline-pu",      name: "Decline push-up",                  equipment: [] },
      { id: "archer-pu",       name: "Archer push-up",                   equipment: [] },
      { id: "one-arm-neg-pu",  name: "One arm push-up negative",         equipment: [] },
      { id: "one-arm-pu",      name: "One arm push-up",                  equipment: [] },
    ],
  },
  {
    label: "Dips", session: "push",
    exercises: [
      { id: "bench-dip",    name: "Bench dip",                           equipment: [] },
      { id: "dip-negative", name: "Dip negative",                        equipment: ["bars"] },
      { id: "banded-dip",   name: "Banded dip",                          equipment: ["bars", "bands"] },
      { id: "dip",          name: "Dip",                                  equipment: ["bars"] },
      { id: "weighted-dip", name: "Weighted dip",                        equipment: ["bars", "weights"] },
    ],
  },
  {
    label: "Legs / Pistol Squat", session: "legs",
    exercises: [
      { id: "bodyweight-squat",      name: "Bodyweight squat",           equipment: [] },
      { id: "deep-squat",            name: "Deep squat",                 equipment: [] },
      { id: "reverse-lunge",         name: "Reverse lunge",              equipment: [] },
      { id: "bulgarian-split-squat", name: "Bulgarian split squat",      equipment: [] },
      { id: "pistol-hand-assist",    name: "Pistol — hand assisted",     equipment: [] },
      { id: "pistol-opp-leg-free",   name: "Pistol — opposing leg free", equipment: [] },
      { id: "elevated-pistol",       name: "Elevated pistol squat",      equipment: [] },
      { id: "standard-pistol",       name: "Standard pistol squat",      equipment: [] },
    ],
  },
  {
    label: "Nordic Curls", session: "legs",
    exercises: [
      { id: "hamstring-bridge",  name: "Lying hamstring curl",                 equipment: [] },
      { id: "nordic-neg-ppt",    name: "Nordic curl — PPT negative",           equipment: ["anchor"] },
      { id: "nordic-neg-ppt-pu", name: "Nordic curl — PPT negative + push-up", equipment: ["anchor"] },
      { id: "nordic-neg-pu",     name: "Nordic curl — negative + push-up",     equipment: ["anchor"] },
      { id: "nordic-standard",   name: "Standard nordic curl",                  equipment: ["anchor"] },
    ],
  },
  {
    label: "Calf Raises", session: "legs",
    exercises: [
      { id: "calf-both",             name: "Calf raise — both legs",         equipment: [] },
      { id: "calf-elevated-both",    name: "Calf raise — elevated both legs", equipment: [] },
      { id: "calf-single",           name: "Calf raise — single leg",         equipment: [] },
      { id: "calf-elevated-single",  name: "Calf raise — elevated single leg",equipment: [] },
    ],
  },
  {
    label: "Leg Raises", session: "core",
    exercises: [
      { id: "knee-raises",           name: "Knee raises",                       equipment: [] },
      { id: "knee-raises-one-leg",   name: "Knee raises — one leg extended",    equipment: [] },
      { id: "standard-leg-raises",   name: "Standard leg raises",               equipment: [] },
    ],
  },
  {
    label: "Hollow Body", session: "core",
    exercises: [
      { id: "hollow-hands-side",     name: "Hollow body — hands on side",    equipment: [] },
      { id: "hollow-hands-overhead", name: "Hollow body — hands overhead",   equipment: [] },
      { id: "hollow-arm-circles",    name: "Hollow body — arm circles",      equipment: [] },
    ],
  },
  {
    label: "Pike Lift", session: "core",
    exercises: [
      { id: "pike-lift-lean-one-leg", name: "Pike lift — backward lean one leg", equipment: [] },
      { id: "pike-lift-one-leg",      name: "Pike lift — one leg",               equipment: [] },
      { id: "pike-lift-both-legs",    name: "Pike lift — both legs",             equipment: [] },
    ],
  },
];

// ─── Skill tree chains ────────────────────────────────────────────────────────
// Full progression ladders for learnable skills.
// Used by pro tier only — free tier does not reference these.

export const SKILL_TREES: { label: string; session: string; ids: string[] }[] = [
  { label: "Front Lever",    session: "pull",      ids: ["tuck-fl", "adv-tuck-fl", "one-leg-fl", "straddle-fl", "full-fl"] },
  { label: "Back Lever",     session: "pull",      ids: ["arch-hang", "skin-the-cat", "german-hang", "tuck-bl", "adv-tuck-bl", "one-leg-bl", "full-bl"] },
  { label: "Muscle-up",      session: "pull",      ids: ["explosive-pullup", "high-pullup", "negative-mu", "kipping-mu", "strict-mu"] },
  { label: "One-arm Pull-up",session: "pull",      ids: ["archer-pullup", "one-arm-neg-pullup", "one-arm-pullup"] },
  { label: "Handstand",      session: "push",      ids: ["wall-plank", "kick-to-wall-hs", "chest-to-wall-hs", "hs-kick-balance", "freestanding-hs"] },
  { label: "HSPU",           session: "push",      ids: ["wall-assisted-hspu", "hspu"] },
  { label: "Planche",        session: "push",      ids: ["planche-lean", "frog-stand", "pseudo-planche-pu", "tuck-planche", "adv-tuck-planche", "straddle-planche", "full-planche"] },
  { label: "L-sit",          session: "legs/core", ids: ["pike-lift-lean-one-leg", "pike-lift-one-leg", "pike-lift-both-legs", "l-sit-foot-supported", "l-sit-one-leg", "l-sit-full", "l-sit-10sec", "l-sit-30sec"] },
  { label: "Dragon Flag",    session: "legs/core", ids: ["dragon-flag-negative", "tuck-dragon-flag", "half-tuck-dragon-flag", "straddle-dragon-flag", "full-dragon-flag"] },
  { label: "Shrimp Squat",  session: "legs",      ids: ["shrimp-squat-assisted", "shrimp-squat-free", "shrimp-squat"] },
  { label: "Human Flag",     session: "legs/core", ids: ["human-flag-prep", "tuck-human-flag", "half-human-flag", "full-human-flag"] },
];

// ─── Schedule templates (shared by both tiers) ────────────────────────────────

export const SCHEDULES: Record<number, string> = {
  1: "Mon=Full Body, Tue=Rest, Wed=Rest, Thu=Rest, Fri=Rest, Sat=Rest, Sun=Rest",
  2: "Mon=Full Body, Tue=Rest, Wed=Rest, Thu=Full Body, Fri=Rest, Sat=Rest, Sun=Rest",
  3: "Mon=Full Body, Tue=Rest, Wed=Full Body, Thu=Rest, Fri=Full Body, Sat=Rest, Sun=Rest",
  4: "Mon=Pull, Tue=Push, Wed=Legs, Thu=Rest, Fri=Full Body, Sat=Rest, Sun=Rest",
  5: "Mon=Pull, Tue=Push, Wed=Legs, Thu=Rest, Fri=Pull, Sat=Push, Sun=Rest",
  6: "Mon=Pull, Tue=Push, Wed=Legs, Thu=Pull, Fri=Push, Sat=Legs, Sun=Rest",
};

export const FOCUS_LABELS: Record<string, string> = {
  Pull:     "Pull — Back & Core",
  Push:     "Push — Chest & Shoulders",
  Legs:     "Legs & Core",
  FullBody: "Full Body",
};

// ─── Utility: filter chains by available equipment ────────────────────────────

export function filterByEquipment(
  chains: ExerciseChain[],
  equipment: Set<EquipmentTag>,
): ExerciseChain[] {
  return chains
    .filter(chain => {
      // Drop entire chain if ALL exercises require missing equipment (e.g. Nordic without anchor)
      return chain.exercises.some(ex =>
        ex.equipment.length === 0 || ex.equipment.every(t => equipment.has(t))
      );
    })
    .map(chain => ({
      ...chain,
      exercises: chain.exercises.filter(ex =>
        ex.equipment.length === 0 || ex.equipment.every(t => equipment.has(t))
      ),
    }));
}
