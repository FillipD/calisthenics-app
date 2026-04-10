// lib/plan.ts
// Generates personalised weekly plans based on skill tree position,
// equipment, days per week, and goal.

import { Goal, WeeklyPlan, TrainingDay, Exercise, SkillGoal } from "@/types";
import { NODE_MAP } from "@/lib/skillTree";
import type { EquipmentTag } from "@/lib/skillTree";

// ─── Equipment: form strings → tree tags ─────────────────────────────────────

const FORM_TO_TAG: Record<string, EquipmentTag> = {
  "Pull-up bar":              "bar",
  "Parallel bars / dip bars": "bars",
  "Rings":                    "rings",
  "Parallettes":              "parallettes",
  "Resistance bands":         "bands",
  "Nordic curl anchor":       "anchor",
  "Weights (belt or vest)":   "weights",
  "Vertical pole":            "pole",
};

function buildEquipSet(equipment: string[]): Set<EquipmentTag> {
  const s = new Set<EquipmentTag>();
  for (const item of equipment) {
    const tag = FORM_TO_TAG[item];
    if (tag) s.add(tag);
  }
  return s;
}

function canUse(nodeId: string, eq: Set<EquipmentTag>): boolean {
  const node = NODE_MAP.get(nodeId);
  if (!node) return false;
  if (!node.equipment?.length) return true;
  return node.equipment.every(t => eq.has(t));
}

// ─── Progression chains (easiest → hardest) ──────────────────────────────────

const CHAIN_VERT_PULL   = ["pullup-negative",        "banded-pullup",          "pullup",              "explosive-pullup"];
const CHAIN_HORIZ_PULL  = ["row-bent-legs",           "row-straight-legs"];
const CHAIN_VERT_PUSH   = ["elevated-pike-pu",        "pike-pu",                "decline-pike-pu",     "decline-pike-parall", "wall-assisted-hspu"];
const CHAIN_DIPS        = ["bench-dip",               "dip-negative",           "banded-dip",          "dip"];
const CHAIN_HORIZ_PUSH  = ["incline-knee-pu",         "knee-pu",                "incline-pu",          "standard-pu",         "explosive-pu"];
const CHAIN_LEGS        = ["bodyweight-squat",         "deep-squat"];
const CHAIN_NORDIC      = ["nordic-neg-ppt",           "nordic-neg-ppt-pu"];
const CHAIN_LEG_RAISES  = ["knee-raises",              "knee-raises-one-leg"];
const CHAIN_HOLLOW      = ["hollow-hands-side",        "hollow-hands-overhead"];
const CHAIN_PIKE_LIFT   = ["pike-lift-lean-one-leg",   "pike-lift-one-leg"];

// ─── Reps per goal ────────────────────────────────────────────────────────────
// Hard sets are ALWAYS 2×3-5 regardless of goal.
// Goal only affects working set volume; working sets NEVER use 3-5 reps.

function repsFor(goal: Goal) {
  const hSets = 2, hReps = "3-5";
  if (goal === "build-muscle") return { hSets, hReps, wSets: 4, wReps: "8-12" };
  /* build-strength and build-strength-muscle */
  return { hSets, hReps, wSets: 3, wReps: "5-10" };
}

// ─── Core chain builder ───────────────────────────────────────────────────────
// Returns 1–2 Exercise entries for a movement pattern:
//   • Normal:    2×hReps of next step  +  3×wReps of current step
//   • Top step:  2×hReps of current    +  3×wReps of highest accessible below
//   • First only: 3×wReps of current (no harder step accessible at all)

function buildChain(
  chain: string[],
  idealIdx: number,
  eq: Set<EquipmentTag>,
  goal: Goal,
): Exercise[] {
  // Highest accessible working step at or below idealIdx
  let wIdx = -1;
  for (let i = Math.min(idealIdx, chain.length - 1); i >= 0; i--) {
    if (canUse(chain[i], eq)) { wIdx = i; break; }
  }
  if (wIdx < 0) return [];

  // Next accessible step above wIdx (for hard sets)
  let hIdx = -1;
  for (let i = wIdx + 1; i < chain.length; i++) {
    if (canUse(chain[i], eq)) { hIdx = i; break; }
  }

  const cfg = repsFor(goal);
  const nm  = (id: string) => NODE_MAP.get(id)!.name;

  if (hIdx >= 0) {
    // Normal case: hard sets of next step, working sets of current step
    return [
      { name: nm(chain[hIdx]), sets: cfg.hSets, reps: cfg.hReps, isHardSet: true  },
      { name: nm(chain[wIdx]), sets: cfg.wSets, reps: cfg.wReps, isHardSet: false },
    ];
  }

  // No accessible harder step — find highest accessible step BELOW wIdx for working sets
  let prevIdx = -1;
  for (let i = wIdx - 1; i >= 0; i--) {
    if (canUse(chain[i], eq)) { prevIdx = i; break; }
  }

  if (prevIdx >= 0) {
    // At the top of the accessible chain: hard of current, working of previous
    return [
      { name: nm(chain[wIdx]),    sets: cfg.hSets, reps: cfg.hReps, isHardSet: true  },
      { name: nm(chain[prevIdx]), sets: cfg.wSets, reps: cfg.wReps, isHardSet: false },
    ];
  }

  // Only one accessible step, no challenge above: just working sets
  return [{ name: nm(chain[wIdx]), sets: cfg.wSets, reps: cfg.wReps, isHardSet: false }];
}

// ─── Dips — working set only, 3×5-10, with auto-progression note ─────────────
// Dips use a simpler model: no hard/working split. The user does 3×5-10 of
// their current step; when they hit 10+ consistently, the plan advances them.

function buildDips(chain: string[], idealIdx: number, eq: Set<EquipmentTag>): Exercise[] {
  let wIdx = -1;
  for (let i = Math.min(idealIdx, chain.length - 1); i >= 0; i--) {
    if (canUse(chain[i], eq)) { wIdx = i; break; }
  }
  if (wIdx < 0) return [];
  return [{
    name: NODE_MAP.get(chain[wIdx])!.name,
    sets: 3,
    reps: "5-10",
    isHardSet: false,
  }];
}

// ─── Core exercises — fixed 3×Max, no hard set, goal-independent ─────────────

function buildCore(chain: string[], idealIdx: number, eq: Set<EquipmentTag>): Exercise[] {
  let wIdx = -1;
  for (let i = Math.min(idealIdx, chain.length - 1); i >= 0; i--) {
    if (canUse(chain[i], eq)) { wIdx = i; break; }
  }
  if (wIdx < 0) return [];
  return [{ name: NODE_MAP.get(chain[wIdx])!.name, sets: 3, reps: "Max", isHardSet: false }];
}

// ─── Skill work (4+ days/week only) ──────────────────────────────────────────
// Ordered progression chains for each terminal skill goal (easiest → goal node)

const SKILL_BRANCH: Record<string, string[]> = {
  "full-fl":          ["tuck-fl",             "adv-tuck-fl",           "one-leg-fl",          "straddle-fl",       "full-fl"],
  "full-bl":          ["arch-hang",            "skin-the-cat",          "german-hang",         "tuck-bl",           "adv-tuck-bl",      "one-leg-bl",        "full-bl"],
  "strict-mu":        ["negative-mu",          "kipping-mu",            "strict-mu"],
  "one-arm-pullup":   ["one-arm-neg-pullup",   "one-arm-pullup"],
  "freestanding-hs":  ["wall-plank",           "kick-to-wall-hs",       "chest-to-wall-hs",    "hs-kick-balance",   "freestanding-hs"],
  "hspu":             ["wall-assisted-hspu",   "hspu"],
  "full-planche":     ["planche-lean",         "frog-stand",            "pseudo-planche-pu",   "tuck-planche",      "adv-tuck-planche", "straddle-planche", "full-planche"],
  "planche":          ["planche-lean",         "frog-stand",            "pseudo-planche-pu",   "tuck-planche",      "adv-tuck-planche", "straddle-planche", "full-planche"],
  "full-dragon-flag": ["dragon-flag-negative", "tuck-dragon-flag",      "half-tuck-dragon-flag","straddle-dragon-flag","full-dragon-flag"],
  "l-sit-30sec":      ["l-sit-foot-supported", "l-sit-one-leg",         "l-sit-full",          "l-sit-10sec",       "l-sit-30sec"],
  "full-human-flag":  ["human-flag-prep",      "tuck-human-flag",       "half-human-flag",     "full-human-flag"],
  "shrimp-squat":     ["shrimp-squat-assisted", "shrimp-squat-free",    "shrimp-squat"],
  "ring-muscle-up":   ["false-grip-hang",       "false-grip-pullup",    "ring-negative-mu",    "ring-mu"],
};

// Which session type each skill goal feeds into
// Keys must include both terminal node IDs and ProGoalId strings — user_skills
// stores skill_name as a ProGoalId (e.g. "muscle-up"), not a terminal node ID.
const SKILL_SESSION: Record<string, "pull" | "push" | "legs"> = {
  // terminal node IDs
  "full-fl":          "pull",
  "full-bl":          "pull",
  "strict-mu":        "pull",
  "one-arm-pullup":   "pull",
  "ring-mu":          "pull",
  "freestanding-hs":  "push",
  "hspu":             "push",
  "full-planche":     "push",
  "full-dragon-flag": "legs",
  "l-sit-30sec":      "legs",
  "full-human-flag":  "legs",
  // ProGoalId keys (stored in user_skills.skill_name)
  "muscle-up":        "pull",
  "front-lever":      "pull",
  "back-lever":       "pull",
  "ring-muscle-up":   "pull",
  "handstand":        "push",
  "handstand-pushup": "push",
  "planche":          "push",
  "l-sit":            "legs",
  "pistol-squat":     "legs",
  "shrimp-squat":     "legs",
};

// Dynamic skills = max reps; all others = max sec hold
// Must include both terminal node IDs and ProGoalId strings.
const SKILL_IS_DYNAMIC = new Set([
  "strict-mu", "one-arm-pullup", "hspu", "full-dragon-flag", "ring-mu",
  "muscle-up", "handstand-pushup", "ring-muscle-up", "shrimp-squat", "pistol-squat",
]);

function buildSkillWork(
  sessionType: "pull" | "push" | "legs",
  skillGoals: SkillGoal[],
): Exercise[] {
  const result: Exercise[] = [];
  for (const { skill_name, current_progression } of skillGoals) {
    if (SKILL_SESSION[skill_name] !== sessionType) continue;
    const node = NODE_MAP.get(current_progression);
    if (!node) continue;
    result.push({
      name: node.name,
      sets: 3,
      reps: SKILL_IS_DYNAMIC.has(skill_name) ? "Max" : "Max sec",
      isHardSet: false,
      progressionNote: "Focus on quality over quantity — rest 2–3 minutes between sets",
    });
  }
  return result;
}

// ─── Calf raise — fixed 3×Max (no hard/working split per spec) ───────────────

const CALF_EX: Exercise = {
  name: NODE_MAP.get("calf-both")!.name,
  sets: 3, reps: "Max", isHardSet: false,
};

// ─── Assessment → ideal chain index ──────────────────────────────────────────

const vertPullIdx  = (pu: number) => pu === 0 ? 0 : pu <= 4 ? 1 : 2;
const dipIdx       = (d: number)  => d === 0  ? 0 : d <= 3  ? 1 : 2;
const horizPushIdx = (pu: number) => pu <= 5  ? 0 : pu <= 10 ? 1 : pu <= 20 ? 2 : 3;

// ─── Session builders ─────────────────────────────────────────────────────────

interface Inputs {
  pullUps:      number;
  pushUps:      number;
  dips:         number;
  goal:         Goal;
  eq:           Set<EquipmentTag>;
  weekNumber:   number; // 1-based; used to alternate full-body core exercise
  skillGoals:   SkillGoal[];
}

function fullBodySession(label: string, inp: Inputs): TrainingDay {
  const { pullUps, pushUps, dips, goal, eq, weekNumber } = inp;
  // Alternate core pattern by week: odd weeks → leg raises, even weeks → hollow body
  const coreChain = weekNumber % 2 !== 0 ? CHAIN_LEG_RAISES : CHAIN_HOLLOW;
  return {
    day: label, type: "training", focus: "Full Body",
    exercises: [
      ...buildChain(CHAIN_VERT_PULL,  vertPullIdx(pullUps),  eq, goal),
      ...buildChain(CHAIN_HORIZ_PUSH, horizPushIdx(pushUps), eq, goal),
      ...buildDips(CHAIN_DIPS,        dipIdx(dips),           eq),
      ...buildChain(CHAIN_LEGS,       0,                      eq, goal),
      ...buildCore(coreChain,          0,                      eq),
    ],
  };
}

function pullSession(label: string, inp: Inputs): TrainingDay {
  const { pullUps, goal, eq, skillGoals } = inp;
  const skillWork = buildSkillWork("pull", skillGoals);
  return {
    day: label, type: "training", focus: "Pull — Back & Core",
    exercises: [
      ...buildChain(CHAIN_VERT_PULL,  vertPullIdx(pullUps), eq, goal),
      ...buildChain(CHAIN_HORIZ_PULL, 0,                     eq, goal),
      ...buildCore(CHAIN_LEG_RAISES,   0,                     eq),
      ...buildCore(CHAIN_HOLLOW,       0,                     eq),
    ],
    ...(skillWork.length > 0 ? { skillWork } : {}),
  };
}

function pushSession(label: string, inp: Inputs): TrainingDay {
  const { pushUps, dips, goal, eq, skillGoals } = inp;
  const skillWork = buildSkillWork("push", skillGoals);
  return {
    day: label, type: "training", focus: "Push — Shoulders, Chest & Triceps",
    exercises: [
      ...buildChain(CHAIN_VERT_PUSH,  0,                     eq, goal),
      ...buildDips(CHAIN_DIPS,        dipIdx(dips),           eq),
      ...buildChain(CHAIN_HORIZ_PUSH, horizPushIdx(pushUps),  eq, goal),
      ...buildCore(CHAIN_PIKE_LIFT,    0,                     eq),
    ],
    ...(skillWork.length > 0 ? { skillWork } : {}),
  };
}

function legsSession(label: string, inp: Inputs): TrainingDay {
  const { goal, eq, skillGoals } = inp;
  const skillWork = buildSkillWork("legs", skillGoals);
  return {
    day: label, type: "training", focus: "Legs & Core",
    exercises: [
      ...buildChain(CHAIN_LEGS,      0, eq, goal),
      ...buildChain(CHAIN_NORDIC,    0, eq, goal), // empty [] if no anchor equipment
      CALF_EX,
      ...buildCore(CHAIN_HOLLOW,     0, eq),
    ],
    ...(skillWork.length > 0 ? { skillWork } : {}),
  };
}

// ─── Week layout ─────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const rest = (i: number): TrainingDay => ({ day: DAYS[i], type: "rest" });

function buildWeek(daysPerWeek: number, inp: Inputs): TrainingDay[] {
  const fb   = (i: number) => fullBodySession(DAYS[i], inp);
  const pull = (i: number) => pullSession(DAYS[i], inp);
  const push = (i: number) => pushSession(DAYS[i], inp);
  const legs = (i: number) => legsSession(DAYS[i], inp);

  switch (daysPerWeek) {
    case 1: return [fb(0),   rest(1), rest(2), rest(3), rest(4), rest(5), rest(6)];
    case 2: return [fb(0),   rest(1), rest(2), fb(3),   rest(4), rest(5), rest(6)];
    case 3: return [fb(0),   rest(1), fb(2),   rest(3), fb(4),   rest(5), rest(6)];
    case 4: return [pull(0), push(1), legs(2), rest(3), fb(4),   rest(5), rest(6)];
    case 5: return [pull(0), push(1), legs(2), rest(3), pull(4), push(5), rest(6)];
    default: return [pull(0), push(1), legs(2), pull(3), push(4), legs(5), rest(6)];
  }
}

// ─── Plan note per goal ───────────────────────────────────────────────────────

function planNote(goal: Goal): string {
  if (goal === "build-strength")
    return "Hard sets (2×3-5) are your main stimulus — treat them as near-maximal efforts. Rest 2–3 minutes between sets so your nervous system is fresh. Working sets build volume at a controlled intensity. Focus on slow, controlled negatives to maximise tension on every rep.";
  if (goal === "build-muscle")
    return "Hard sets prime your nervous system for the heavier movement. Working sets (4×8-12) are where muscle is built — push close to failure on every set. Rest 90 seconds between sets. Aim for 1.6–2g of protein per kg of bodyweight daily. Sleep is when you grow.";
  return "Hard sets build strength on the harder movement; working sets build volume on your current level. Rest 90–120 seconds between sets. Log your reps each session — progressive overload is the only metric that matters. Strength and muscle reinforce each other.";
}

// ─── Level-based rep approximations (for dashboard / server pages that don't
//     have raw rep counts, only the stored level) ────────────────────────────

export const LEVEL_REPS: Record<string, { pullUps: number; pushUps: number; dips: number }> = {
  "Beginner":     { pullUps: 0,  pushUps: 3,  dips: 0  },
  "Beginner+":    { pullUps: 2,  pushUps: 10, dips: 2  },
  "Intermediate": { pullUps: 5,  pushUps: 20, dips: 5  },
  "Advanced":     { pullUps: 10, pushUps: 30, dips: 10 },
};

/** Called from server pages that have profile data but not raw rep counts. */
export function generatePlanFromProfile(
  profile: {
    level: string;
    goal: string;
    days_per_week?: number | null;
    equipment?: string[] | null;
    created_at?: string | null;
  },
  skillGoals: SkillGoal[] = [],
): WeeklyPlan {
  const reps = LEVEL_REPS[profile.level] ?? LEVEL_REPS["Beginner"];
  // Derive week number from sign-up date so core alternation is accurate
  const weekNumber = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : 1;
  return generatePlan(
    reps.pullUps, reps.pushUps, reps.dips,
    profile.goal as Goal,
    profile.days_per_week ?? 3,
    profile.equipment ?? [],
    weekNumber,
    skillGoals,
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePlan(
  pullUps:      number,
  pushUps:      number,
  dips:         number,
  goal:         Goal,
  daysPerWeek:  number,
  equipment:    string[],
  weekNumber  = 1,
  skillGoals:   SkillGoal[] = [],
): WeeklyPlan {
  const eq  = buildEquipSet(equipment);
  const inp: Inputs = { pullUps, pushUps, dips, goal, eq, weekNumber, skillGoals };
  return {
    days: buildWeek(Math.max(1, Math.min(6, daysPerWeek)), inp),
    note: planNote(goal),
  };
}
