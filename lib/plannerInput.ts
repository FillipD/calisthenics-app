// lib/plannerInput.ts
// Builds a structured PlannerInput object from user state.
//
// This layer computes the planning boundaries deterministically before the AI
// sees any data. The result contains explicit exercise pools, step prescriptions,
// volume constraints, and per-goal frequency targets — so Gemini receives
// bounded constraints rather than annotated chain text it has to interpret.
//
// The key guarantees:
//   allowedPool per WorkoutSlot = every exercise name the user actually has
//     equipment for in that pattern — Gemini must pick names verbatim.
//   volumePerSession = total exercise count (skillWork + exercises) derived
//     from the user's session length preference.
//   skillWorkCapacity = max skill goal blocks per session, ensuring secondary
//     goals only appear when there's room.
//   weeklyDedicatedSessions per goal = count of dedicated (non-full-body)
//     sessions for that goal's session type, so Gemini knows primary goals
//     get more weekly skill work than secondary ones.

import { NODE_MAP, findNextSkillStep, getSkillChain } from "./skillTree";
import { WORKOUT_CHAINS, SCHEDULES } from "./exerciseData";
import { PRO_GOAL_MAP } from "./proOnboarding";
import type { Goal, SkillGoal, SwapOptions } from "@/types";
import type { EquipmentTag } from "./skillTree";

// ─── Reverse name lookup ──────────────────────────────────────────────────────
// Built once at module load from NODE_MAP. Used for near-duplicate detection.
const NAME_TO_ID: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [id, node] of NODE_MAP) m.set(node.name.toLowerCase(), id);
  return m;
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkoutSlot {
  /** Movement pattern label, e.g. "Vertical Pull" */
  pattern:     string;
  /** Session type this pattern belongs to */
  session:     "pull" | "push" | "legs" | "core";
  /** Exercise name at the user's current working level — use as main working set */
  workingSet:  string;
  /** Next exercise name for 2 exposure hard sets, or null if at top / missing equipment */
  hardSet:     string | null;
  /**
   * Full equipment-filtered name list for this pattern.
   * Gemini MUST use names exactly as written here — no invented variations.
   */
  allowedPool: string[];
  /**
   * Peer-level same-difficulty alternatives to the workingSet exercise,
   * derived from TreeNode.alternatives and filtered to the user's equipment.
   * Safe to use for variety or equipment-driven substitution in support work.
   * Do NOT substitute for the primary working set — progression intent is tied
   * to the workingSet node.
   */
  peerAlternatives: string[];
  /**
   * Subset of the full chain excluded from allowedPool because they are more than
   * REGRESSION_THRESHOLD difficulty levels below the workingSet.
   * Listed for validation diagnostics only — must not appear in exercises[].
   */
  regressedPool: string[];
  /**
   * Non-null when this slot is a lower-value alternative within its movement family
   * and another slot in the same family is already present at a significantly higher
   * level. Gemini should skip this slot when session volume is at budget — it is
   * the lowest-priority pattern to include.
   * Null = this slot should normally be filled.
   */
  skipReason: string | null;
  /**
   * Level-appropriate subset of allowedPool for support and accessory exercise
   * selection. Includes exercises within ±2 difficulty levels of the workingSet,
   * plus peerAlternatives. Exercises outside this range are too hard to be typical
   * support choices (but remain in allowedPool for hard-set / aspirational use).
   * When no difficulty data exists, falls back to ±2 positional proximity.
   */
  suggestedSupportRange: string[];
  /**
   * Exercise name pairs within this slot's allowedPool that are near-duplicates —
   * either explicit peer alternatives (in each other's alternatives list) or
   * same-branch exercises at similar difficulty. Using both in the same role
   * within a session adds little value. Using them in different roles
   * (skill work + support, hard set + working set) is fine.
   */
  nearDuplicatePairs: Array<[string, string]>;
  /**
   * Transitive-closure clusters of near-duplicate exercises within this slot's pool.
   * Each group contains 2+ exercises that are mutually substitutable in the same role.
   * nearDuplicatePairs is derived from these groups (all pairwise combos).
   * Use groups for validation — a single violation covers the whole cluster.
   */
  nearDuplicateGroups: Array<string[]>;
}

/**
 * Structured support-work guidance for a single skill goal.
 * All data is derived deterministically from the skill tree and workout slots —
 * no AI involvement. Gemini uses this to make better support-work decisions.
 */
export interface SkillSupportContext {
  /**
   * Workout slot patterns to bias toward when choosing support exercises.
   * Each entry maps a real WorkoutSlot.pattern label to the reason it helps.
   * Only slots the user actually has equipment for are included.
   */
  emphasisSlots: Array<{
    pattern: string;  // exact WorkoutSlot.pattern label, e.g. "Horizontal Pull"
    reason:  string;  // why this pattern supports the goal
  }>;
  /**
   * Up to 2 earlier chain steps (closest-first) useful as sub-max foundation work
   * and pattern warm-up before the working set.
   */
  foundationWork: Array<{
    name:    string;
    purpose: string;
  }>;
  /**
   * Prerequisite nodes for the current/next chain steps that are not yet completed.
   * Signals to Gemini that these specific strengths are still missing.
   */
  missingPrerequisites: Array<{
    name: string;
    role: string;  // e.g. "prerequisite for Strict muscle-up"
  }>;
  /**
   * Peer-level same-difficulty alternatives to the current skill step,
   * derived from TreeNode.alternatives and filtered to the user's equipment.
   * Useful for support work variety or when this goal appears as a secondary.
   * Must NOT replace the primary skill block — the current step is mandatory for tracking.
   */
  peerAlternatives: Array<{
    name: string;
    note: string;  // e.g. "supinated grip — same difficulty"
  }>;
}

export interface SkillGoalContext {
  goalId:           string;
  goalLabel:        string;
  session:          string;
  /** 1 = primary goal (build program around this); 2+ = secondary (weave in as support) */
  priority:         number;
  currentStepName:  string;
  /** Node ID of the user's current step (e.g. "tuck-fl") — used for swap resolution */
  currentStepNodeId: string;
  /** Terminal node ID of the goal progression (e.g. "full-fl") — used as chain anchor */
  terminalNodeId:    string;
  prescription:     string;
  advanceCondition: string;
  nextStepName:     string | null;
  /**
   * Number of dedicated (non-full-body) sessions of this goal's session type
   * per week. Tells Gemini how often this skill goal can appear in the plan.
   * Full-body days are excluded because skill work is skipped on those days.
   */
  weeklyDedicatedSessions: number;
  /**
   * Structured support-work guidance derived from prerequisites, chain position,
   * and goal-specific movement relationships.
   */
  support: SkillSupportContext;
}

// ─── Weekly balance types ─────────────────────────────────────────────────────

/**
 * Per-goal recommended session count for this week, with a reason when capped.
 * Accounts for session length, primary/secondary priority, and session-type overlap.
 */
export interface GoalFrequency {
  goalId:              string;
  goalLabel:           string;
  priority:            number;
  sessionType:         string;
  /** Exact number of sessions this week Gemini should include skill work for this goal */
  recommendedSessions: number;
  /** Non-null when the count was reduced below the available dedicated sessions */
  cappedReason:        string | null;
}

/**
 * Identified recovery-competing pair between the primary and a secondary goal.
 * Severity and guidance are derived from known movement patterns and session types.
 */
export interface OverlapRisk {
  primaryGoalId:   string;
  secondaryGoalId: string;
  severity:        "same-session" | "same-pattern" | "same-category";
  reason:          string;
  /** Concrete instruction: how Gemini should handle this pair in the week */
  guidance:        string;
}

/**
 * Week-level balancing guide. Computed deterministically from goals, session
 * length, and schedule — Gemini uses this to keep primary goal dominant and
 * avoid recovery-competing secondary stacking.
 */
export interface WeeklyBalanceGuide {
  goalFrequencies:    GoalFrequency[];
  overlapRisks:       OverlapRisk[];
  /**
   * For each session type present in the week, the goalIds in drop-last-first order.
   * When volume is tight, the last-listed goal's skill work is cut first.
   */
  sessionPriorityMap: Record<string, string[]>;
}

export interface PlannerInput {
  weekNumber:    number;
  goalLabel:     string;
  repScheme:     string;
  daysPerWeek:   number;
  schedule:      string;
  equipment:     string[];
  /** Session length preference in minutes: "30" | "45" | "60" | "90" */
  sessionLength: string;
  /**
   * Total exercise count target per training session (skillWork + exercises combined).
   * Derived from session length.
   */
  volumePerSession: { min: number; max: number };
  /**
   * Maximum number of skill work blocks per session. Always ≥ 1 when skill goals exist —
   * primary goal skill work is never removed. Secondary goals consume additional slots.
   */
  skillWorkCapacity: number;
  /**
   * When true (30 or 45 min): only the primary goal (priority 1) gets dedicated skill work.
   * Secondary goals are skipped. Accessories and hard sets are dropped first to stay in budget.
   * Primary goal skill work is mandatory regardless of session length.
   */
  primarySkillWorkOnly: boolean;
  workoutSlots:   WorkoutSlot[];
  skillGoals:     SkillGoalContext[];
  weeklyBalance:  WeeklyBalanceGuide;
  recentHistory:      string;
  /**
   * Per-exercise performance signals derived from recent logs evaluated against
   * the previous week's prescriptions. Empty string when no logged data is available.
   * Rendered as the PERFORMANCE SIGNALS section in the Gemini prompt.
   */
  performanceSignals: string;
  /**
   * Per-day session emphasis for repeated same-category days.
   * Key = day name (e.g. "Monday"). Value = emphasis note for that specific session.
   * Only populated for days where the session type appears more than once in the week.
   * Gemini uses this to make same-category days meaningfully different without
   * removing any required movement patterns.
   */
  sessionEmphasis: Record<string, string>;
  /**
   * Cross-slot near-duplicate clusters: exercises from different WorkoutSlots (same
   * session type) that are peer alternatives to each other. Using more than one from
   * the same cluster in the same session role wastes volume.
   */
  sessionNearDuplicateClusters: Array<string[]>;
}

// ─── Skill session routing ────────────────────────────────────────────────────

const SKILL_SESSION: Record<string, string> = {
  // terminal node ids
  "full-fl":          "pull",  "full-bl":          "pull",  "strict-mu":         "pull",
  "one-arm-pullup":   "pull",  "ring-mu":          "pull",
  "freestanding-hs":  "push",  "hspu":             "push",  "full-planche":      "push",
  "full-dragon-flag": "legs",  "l-sit-30sec":      "legs",  "full-human-flag":   "legs",
  // ProGoalId keys
  "muscle-up":        "pull",  "front-lever":      "pull",  "back-lever":        "pull",
  "ring-muscle-up":   "pull",  "handstand":        "push",  "handstand-pushup":  "push",
  "planche":          "push",  "l-sit":            "legs",  "pistol-squat":      "legs",
  "shrimp-squat":     "legs",
};

// ─── Session length → volume + capacity ──────────────────────────────────────
// skillWorkCapacity is always ≥ 1 — primary goal skill work is never removed.
// primarySkillWorkOnly=true means secondary goals are excluded for that session length.
// Within-budget cuts follow the priority order: accessories first, then secondaries,
// never primary skill work.

function volumeFromSessionLength(sessionLength: string): {
  min: number;
  max: number;
  skillWorkCapacity: number;
  primarySkillWorkOnly: boolean;
} {
  switch (sessionLength) {
    // 30 min: tight budget — primary skill work only, no hard sets, minimal accessories
    case "30": return { min: 3, max: 4, skillWorkCapacity: 1, primarySkillWorkOnly: true };
    // 45 min: primary skill work only — secondaries dropped, one hard set per session if room
    case "45": return { min: 4, max: 5, skillWorkCapacity: 1, primarySkillWorkOnly: true };
    // 90 min: full budget — primary + secondary skill work + hard sets
    case "90": return { min: 6, max: 8, skillWorkCapacity: 2, primarySkillWorkOnly: false };
    // 60 min default: primary + one secondary skill work slot
    default:   return { min: 5, max: 6, skillWorkCapacity: 2, primarySkillWorkOnly: false };
  }
}

// ─── Schedule parser — counts dedicated sessions per type ─────────────────────
// Parses "Mon=Pull, Tue=Push, Wed=Legs, ..." into a count per session type.
// Full Body is counted separately — skill work is skipped on those days.

function countDedicatedSessions(schedule: string): Record<string, number> {
  const counts: Record<string, number> = { pull: 0, push: 0, legs: 0 };
  for (const part of schedule.split(", ")) {
    const val = part.split("=")[1]?.trim();
    if (val === "Pull")       counts.pull++;
    else if (val === "Push")  counts.push++;
    else if (val === "Legs")  counts.legs++;
    // "Full Body" and "Rest" are intentionally excluded
  }
  return counts;
}

// ─── Chain position helpers ───────────────────────────────────────────────────

function findCurrentInChain(
  ids:         string[],
  progressMap: Record<string, string>,
): string | null {
  // Prefer explicitly-marked "current"
  for (let i = ids.length - 1; i >= 0; i--) {
    if (progressMap[ids[i]] === "current") return ids[i];
  }
  // Fall back to step after the last "completed"
  for (let i = ids.length - 1; i >= 0; i--) {
    if (progressMap[ids[i]] === "completed") {
      return ids[Math.min(i + 1, ids.length - 1)];
    }
  }
  return null;
}

// ─── Rep-count fallbacks ──────────────────────────────────────────────────────
// Only used when a user has no saved progress at all (edge case: legacy users
// who existed before pro onboarding was shipped, or gaps in chain tracking).
//
// Each case maps max-rep count to a node ID in that chain.
// The caller checks `availableIds.includes(fbId)` before using, so IDs that
// require equipment the user doesn't have will fall through to the next
// available position gracefully.

function repCountFallbackId(
  pattern:  string,
  pullUps:  number,
  pushUps:  number,
  dips:     number,
): string | null {
  if (pattern === "Vertical Pull") {
    // 15 pull-ups → weighted-pullup; 8–12 → explosive-pullup; 4–7 → pullup
    if (pullUps >= 13) return "weighted-pullup";
    if (pullUps >= 8)  return "explosive-pullup";
    if (pullUps >= 4)  return "pullup";
    return "pullup-negative";
  }
  if (pattern === "Chin-up") {
    // Chin-up ability tracks closely with pull-up ability.
    // Previously this case returned pull-up IDs by mistake — they never matched
    // the Chin-up chain and caused every user to default to chinup-negative.
    if (pullUps >= 8)  return "explosive-chinup";
    if (pullUps >= 4)  return "chinup";
    return "chinup-negative";
  }
  if (pattern === "Horizontal Pull") {
    // Previously missing — caused every user to default to row-bent-legs (easiest).
    // Row strength scales with vertical pulling ability.
    if (pullUps >= 12) return "row-elevated-legs"; // bodyweight diff-4; weighted-row for those with weights will come from progress data
    if (pullUps >= 6)  return "row-straight-legs";
    return "row-bent-legs";
  }
  if (pattern === "Horizontal Push") {
    if (pushUps >= 30) return "explosive-pu";
    if (pushUps >= 20) return "standard-pu";
    if (pushUps >= 10) return "incline-pu";
    if (pushUps >= 4)  return "knee-pu";
    return "incline-knee-pu";
  }
  if (pattern === "Dips") {
    if (dips >= 8)  return "weighted-dip";
    if (dips >= 4)  return "dip";
    if (dips >= 1)  return "dip-negative";
    return "bench-dip";
  }
  return null;
}

// ─── Prescription + advance condition ────────────────────────────────────────

function extractPrescription(nodeId: string): string {
  const node = NODE_MAP.get(nodeId);
  if (!node) return "3–5 sets × max reps";

  const px = node.prescription;
  if (px) {
    const parts: string[] = [];
    if (px.sets) parts.push(`${px.sets} sets`);
    if (px.hold) parts.push(`× ${px.hold} hold`);
    else if (px.reps) parts.push(`× ${px.reps} reps`);
    if (px.frequency) parts.push(`| ${px.frequency}`);
    if (parts.length > 0) return parts.join(" ");
  }

  const style = node.trainingStyle;
  if (style === "holds") return "3–5 sets × max hold (seconds)";
  if (style === "reps" || style === "explosive" || style === "eccentrics") return "3–5 sets × max controlled reps";

  const name = node.name.toLowerCase();
  return name.includes("lever") || name.includes("flag") ||
         name.includes("planche") || name.includes("handstand") ||
         name.includes("l-sit")
    ? "3–5 sets × max hold (seconds)"
    : "3–5 sets × max controlled reps";
}

function extractAdvanceCondition(nodeId: string, nextNodeId: string | null): string {
  const node     = NODE_MAP.get(nodeId);
  const nextNode = nextNodeId ? NODE_MAP.get(nextNodeId) : null;
  const ax       = node?.assessment;

  if (ax && nextNode) {
    if (ax.metric === "seconds") return `when ${ax.target}s hold → advance to ${nextNode.name}`;
    if (ax.metric === "reps")    return `when ${ax.target} clean reps → advance to ${nextNode.name}`;
    return `when achieved → advance to ${nextNode.name}`;
  }
  if (nextNode) return `next step: ${nextNode.name}`;
  return "goal complete — maintain and push for max performance";
}

// ─── Goal support map ─────────────────────────────────────────────────────────
// Per-goal list of WorkoutSlot patterns that directly support skill development,
// with a concise reason for each. Patterns must exactly match WORKOUT_CHAINS labels.
// Only patterns for which the user has a matching slot (equipment-filtered) are used.

const GOAL_SUPPORT_MAP: Record<string, Array<{ pattern: string; reason: string }>> = {
  "front-lever": [
    { pattern: "Horizontal Pull", reason: "row strength directly underpins the horizontal pulling force needed for the lever" },
    { pattern: "Hollow Body",     reason: "anterior chain tension and scapular depression are required to hold the lever" },
    { pattern: "Leg Raises",      reason: "hip flexor compression and straight-body control transfer to the lever position" },
  ],
  "back-lever": [
    { pattern: "Vertical Pull",   reason: "overhead pulling and shoulder girdle prep" },
    { pattern: "Horizontal Pull", reason: "scapular retraction and straight-arm control" },
    { pattern: "Hollow Body",     reason: "body tension and spinal alignment under load" },
  ],
  "muscle-up": [
    { pattern: "Vertical Pull",   reason: "explosive high pull is the primary driver of the muscle-up pull phase" },
    { pattern: "Dips",            reason: "dip lockout strength is mandatory for the transition and press phase" },
    { pattern: "Chin-up",         reason: "supinated grip pulling strength and high-pull lat engagement" },
  ],
  "ring-muscle-up": [
    { pattern: "Vertical Pull",   reason: "explosive pulling power through false-grip range of motion" },
    { pattern: "Dips",            reason: "ring dip is a direct prerequisite for lockout strength" },
    { pattern: "Horizontal Pull", reason: "ring row for false-grip stability and ring-specific pulling control" },
  ],
  "handstand": [
    { pattern: "Vertical Push",   reason: "overhead shoulder strength and wrist pressing base" },
    { pattern: "Pike Lift",       reason: "compression strength and pike flexibility for kick-up mechanics" },
    { pattern: "Hollow Body",     reason: "midline stiffness is the core skill of handstand alignment" },
  ],
  "handstand-pushup": [
    { pattern: "Vertical Push",   reason: "overhead pressing strength is the direct driver of HSPU progress" },
    { pattern: "Horizontal Push", reason: "horizontal pushing carries over to shoulder and triceps pressing capacity" },
    { pattern: "Dips",            reason: "triceps lockout from dips transfers directly to HSPU lockout" },
  ],
  "planche": [
    { pattern: "Horizontal Push", reason: "protraction and straight-arm pressing strength" },
    { pattern: "Hollow Body",     reason: "anterior chain tension and protraction under load are the planche foundation" },
    { pattern: "Pike Lift",       reason: "pike compression supports tuck and advanced planche positions" },
  ],
  "l-sit": [
    { pattern: "Leg Raises",    reason: "hip flexor strength for the compressed L-sit position" },
    { pattern: "Hollow Body",   reason: "straight-arm posterior pelvic tilt and body tension" },
    { pattern: "Pike Lift",     reason: "compression strength and straight-leg raise control" },
  ],
  "pistol-squat": [
    { pattern: "Legs / Pistol Squat", reason: "progressive unilateral depth loading through the squat chain" },
    { pattern: "Hollow Body",         reason: "anterior chain bracing for stability through the pistol descent" },
  ],
  "shrimp-squat": [
    { pattern: "Legs / Pistol Squat", reason: "unilateral quad and knee-over-toe loading" },
    { pattern: "Nordic Curls",        reason: "hamstring resilience and knee strength complement shrimp loading" },
  ],
};

// ─── Support context builder ───────────────────────────────────────────────────
// Derives structured support guidance for a single skill goal from:
//   - The chain's previous 1–2 steps (foundation/warm-up work)
//   - Prerequisites of the current + next chain steps not yet completed
//   - Goal-specific slot emphasis from GOAL_SUPPORT_MAP
//
// All recommendations are bounded to exercises the user actually has
// equipment for (workoutSlots is already equipment-filtered).

function buildSupportContext(
  goalId:       string,
  chain:        string[],
  currentIdx:   number,
  progressMap:  Record<string, string>,
  workoutSlots: WorkoutSlot[],
  eq:           Set<EquipmentTag>,
): SkillSupportContext {

  // ── Foundation work: closest prior chain step(s) within 2 difficulty levels ─
  // Only includes steps close enough to the current level to be real foundation
  // work. Entries more than 2 levels below are excluded entirely — they are too
  // regressed and also absent from the slot's allowedPool, so Gemini cannot
  // legally use them in exercises[] anyway.
  const foundationWork: SkillSupportContext["foundationWork"] = [];
  const currentStepNode = NODE_MAP.get(chain[currentIdx]);
  const currentStepDiff = currentStepNode?.difficulty;
  for (
    let i = Math.min(chain.length - 1, currentIdx - 1);
    i >= Math.max(0, currentIdx - 2);
    i--
  ) {
    const node = NODE_MAP.get(chain[i]);
    if (!node) continue;

    const diffGap = (currentStepDiff !== undefined && node.difficulty !== undefined)
      ? currentStepDiff - node.difficulty
      : 1; // conservative when data is missing

    // Skip if too far regressed (matches the allowedPool REGRESSION_THRESHOLD)
    if (diffGap > 2) continue;

    const purpose =
      node.trainingStyle === "holds"      ? "sub-max hold sets to warm up the movement pattern"
      : node.trainingStyle === "eccentrics" ? "eccentric loading to reinforce connective tissue"
      :                                       "sub-max reps to reinforce the movement pattern";

    foundationWork.push({ name: node.name, purpose });
  }

  // ── Missing prerequisites: scan current + next 2 chain steps ─────────────
  const missingPrerequisites: SkillSupportContext["missingPrerequisites"] = [];
  const seenPrereqs = new Set<string>();
  for (let i = currentIdx; i < Math.min(chain.length, currentIdx + 3); i++) {
    const node = NODE_MAP.get(chain[i]);
    if (!node?.prerequisites) continue;
    for (const prereqId of node.prerequisites) {
      if (seenPrereqs.has(prereqId)) continue;
      seenPrereqs.add(prereqId);
      if (progressMap[prereqId] === "completed") continue;
      const prereqNode = NODE_MAP.get(prereqId);
      if (prereqNode) {
        missingPrerequisites.push({
          name: prereqNode.name,
          role: `prerequisite for ${node.name}`,
        });
      }
    }
  }

  // ── Emphasis slots: match to goal's support patterns ─────────────────────
  const emphasisSlots: SkillSupportContext["emphasisSlots"] = [];
  const supportPatterns = GOAL_SUPPORT_MAP[goalId] ?? [];
  for (const { pattern, reason } of supportPatterns) {
    if (workoutSlots.some(s => s.pattern === pattern)) {
      emphasisSlots.push({ pattern, reason });
    }
  }

  // ── Peer alternatives: same-difficulty options for the current step ─────────
  // Only include alternatives the user has equipment for.
  // These are for support work variety, not primary skill block replacement.
  const peerAlternatives: SkillSupportContext["peerAlternatives"] = [];
  if (currentIdx >= 0 && currentIdx < chain.length) {
    const currentNode = NODE_MAP.get(chain[currentIdx]);
    for (const altId of currentNode?.alternatives ?? []) {
      const altNode = NODE_MAP.get(altId);
      if (!altNode) continue;
      const hasEquip = !altNode.equipment || altNode.equipment.length === 0 ||
                       altNode.equipment.every(t => eq.has(t));
      if (!hasEquip) continue;
      const patternNote = altNode.movementPattern
        ? altNode.movementPattern.replace(/-/g, " ")
        : "same pattern";
      peerAlternatives.push({ name: altNode.name, note: `${patternNote} — same difficulty` });
    }
  }

  return { emphasisSlots, foundationWork, missingPrerequisites, peerAlternatives };
}

// ─── Known recovery-competing goal pairs ──────────────────────────────────────
// Each entry covers a primary+secondary combination that shares meaningful
// movement fatigue. Order within `goals` is irrelevant — both directions match.
// Goals not in this table fall back to generic same-session-type detection.

interface OverlapPairConfig {
  goals:    [string, string];
  severity: OverlapRisk["severity"];
  reason:   string;
  guidance: string;
}

const OVERLAP_PAIRS: OverlapPairConfig[] = [
  {
    goals:    ["front-lever", "muscle-up"],
    severity: "same-session",
    reason:   "both place heavy straight-arm and shoulder-girdle load on pull sessions",
    guidance: "one primary skill block per pull session (Front Lever); explosive pull work woven in as support, not a separate skill block",
  },
  {
    goals:    ["front-lever", "ring-muscle-up"],
    severity: "same-session",
    reason:   "both place heavy scapular and straight-arm load on pull sessions",
    guidance: "one primary skill block per pull session; ring pulling woven as support — never two separate skill blocks on the same day",
  },
  {
    goals:    ["front-lever", "back-lever"],
    severity: "same-pattern",
    reason:   "both are straight-arm isometric holds with high cumulative shoulder-girdle fatigue",
    guidance: "alternate which gets the full skill block across pull sessions; never programme both on the same day",
  },
  {
    goals:    ["back-lever", "muscle-up"],
    severity: "same-session",
    reason:   "both train in pull sessions with overlapping pulling and shoulder-girdle demand",
    guidance: "one primary skill block per pull session; secondary gets 1–2 working sets only, placed after the primary block",
  },
  {
    goals:    ["back-lever", "ring-muscle-up"],
    severity: "same-session",
    reason:   "both train in pull sessions with overlapping shoulder-girdle and ring-specific fatigue",
    guidance: "one primary skill block per pull session; ring pulling as support only",
  },
  {
    goals:    ["muscle-up", "ring-muscle-up"],
    severity: "same-pattern",
    reason:   "bar and ring muscle-up share almost identical pulling mechanics and connective-tissue fatigue",
    guidance: "train only one variation per session; alternate bar and ring focus across the week",
  },
  {
    goals:    ["planche", "handstand"],
    severity: "same-session",
    reason:   "both place high straight-arm pressing and shoulder-girdle load on push sessions",
    guidance: "one primary skill block per push session; handstand balance practice kept brief (2–3 sets), placed after planche work",
  },
  {
    goals:    ["planche", "handstand-pushup"],
    severity: "same-session",
    reason:   "both place heavy overhead and straight-arm pressing load on push sessions",
    guidance: "one primary skill block per push session; HSPU pressing kept to 2–3 working sets after planche work",
  },
  {
    goals:    ["handstand", "handstand-pushup"],
    severity: "same-pattern",
    reason:   "both use the handstand position with overlapping wrist and shoulder fatigue",
    guidance: "combine into one skill block — handstand balance practice first, then press into HSPU reps",
  },
  {
    goals:    ["pistol-squat", "shrimp-squat"],
    severity: "same-session",
    reason:   "both are unilateral leg skills with high quad and knee load in the same sessions",
    guidance: "one unilateral skill block per legs session; alternate which gets focus across the week",
  },
  {
    goals:    ["l-sit", "pistol-squat"],
    severity: "same-category",
    reason:   "both train in legs sessions with overlapping hip flexor and core demand",
    guidance: "keep total legs skill work to one short block; L-sit practice placed after leg exercises",
  },
  {
    goals:    ["l-sit", "shrimp-squat"],
    severity: "same-category",
    reason:   "both train in legs sessions with overlapping hip flexor and core demand",
    guidance: "keep total legs skill work to one short block; L-sit practice placed after leg exercises",
  },
];

// ─── Weekly balance computation ───────────────────────────────────────────────

function computeGoalFrequencies(
  skillGoals:           SkillGoalContext[],
  primarySkillWorkOnly: boolean,
  daysPerWeek:          number,
): GoalFrequency[] {
  if (skillGoals.length === 0) return [];
  const primary = skillGoals.find(sg => sg.priority === 1);
  if (!primary) return [];

  // Primary sessions: use dedicated count, or estimate half the week for full-body schedules
  const primarySessions = primary.weeklyDedicatedSessions > 0
    ? primary.weeklyDedicatedSessions
    : Math.max(1, Math.ceil(daysPerWeek / 2));

  return skillGoals.map(sg => {
    if (sg.priority === 1) {
      return {
        goalId:              sg.goalId,
        goalLabel:           sg.goalLabel,
        priority:            1,
        sessionType:         sg.session,
        recommendedSessions: primarySessions,
        cappedReason: sg.weeklyDedicatedSessions === 0
          ? "full-body schedule — estimate half of training days"
          : null,
      };
    }

    // Short sessions: no secondary skill work at all
    if (primarySkillWorkOnly) {
      return {
        goalId:              sg.goalId,
        goalLabel:           sg.goalLabel,
        priority:            sg.priority,
        sessionType:         sg.session,
        recommendedSessions: 0,
        cappedReason:        "session ≤ 45 min — secondary skill work excluded",
      };
    }

    let sessions     = sg.weeklyDedicatedSessions;
    let cappedReason: string | null = null;

    // Secondary must always be strictly below primary frequency
    if (sessions >= primarySessions) {
      sessions     = Math.max(0, primarySessions - 1);
      cappedReason = `capped 1 below primary (${primarySessions} sessions)`;
    }

    // Same session type as primary: halve again to avoid crowding the same days
    if (sg.session === primary.session && sessions > 1) {
      const before = sessions;
      sessions     = Math.ceil(sessions / 2);
      cappedReason = `same ${sg.session} session as primary — halved from ${before} to ${sessions} to prevent stacking`;
    }

    return {
      goalId:              sg.goalId,
      goalLabel:           sg.goalLabel,
      priority:            sg.priority,
      sessionType:         sg.session,
      recommendedSessions: sessions,
      cappedReason,
    };
  });
}

function detectOverlapRisks(skillGoals: SkillGoalContext[]): OverlapRisk[] {
  const risks: OverlapRisk[] = [];
  const primary = skillGoals.find(sg => sg.priority === 1);
  if (!primary) return risks;

  const reported = new Set<string>();

  for (const secondary of skillGoals.filter(sg => sg.priority > 1)) {
    const pairKey = [primary.goalId, secondary.goalId].sort().join("+");
    if (reported.has(pairKey)) continue;
    reported.add(pairKey);

    const known = OVERLAP_PAIRS.find(p =>
      (p.goals[0] === primary.goalId   && p.goals[1] === secondary.goalId) ||
      (p.goals[0] === secondary.goalId && p.goals[1] === primary.goalId),
    );

    if (known) {
      risks.push({
        primaryGoalId:   primary.goalId,
        secondaryGoalId: secondary.goalId,
        severity:        known.severity,
        reason:          known.reason,
        guidance:        known.guidance,
      });
    } else if (primary.session === secondary.session) {
      // Generic same-session-type overlap not in the known list
      risks.push({
        primaryGoalId:   primary.goalId,
        secondaryGoalId: secondary.goalId,
        severity:        "same-session",
        reason:          `both goals train in ${primary.session} sessions`,
        guidance:        `limit secondary to 1–2 working sets per ${primary.session} session; primary gets the full dedicated block`,
      });
    }
  }

  return risks;
}

function buildSessionPriorityMap(skillGoals: SkillGoalContext[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const sg of [...skillGoals].sort((a, b) => a.priority - b.priority)) {
    if (!map[sg.session]) map[sg.session] = [];
    map[sg.session].push(sg.goalId);
  }
  return map;
}

// ─── Per-day session emphasis ─────────────────────────────────────────────────
// When the same session type (pull/push/legs) appears multiple times in the week,
// each occurrence gets a concrete emphasis note. Gemini uses these to vary
// programming between sessions of the same category without removing any required
// movement patterns — variation is by emphasis, not by exclusion.

function buildSessionEmphasis(schedule: string): Record<string, string> {
  // Pass 1: count total occurrences of each session type
  const totals: Record<string, number> = {};
  for (const part of schedule.split(", ")) {
    const type = part.split("=")[1]?.trim().toLowerCase();
    if (!type || type === "rest" || type === "full body") continue;
    totals[type] = (totals[type] ?? 0) + 1;
  }

  // Pass 2: assign per-day emphasis for types that appear 2+ times
  const emphasis: Record<string, string> = {};
  const occurrence: Record<string, number> = {};
  for (const part of schedule.split(", ")) {
    const [day, rawType] = part.split("=").map(s => s.trim());
    if (!rawType) continue;
    const type = rawType.toLowerCase();
    if (type === "rest" || type === "full body") continue;
    if ((totals[type] ?? 1) < 2) continue; // single occurrence — no variation needed

    occurrence[type] = (occurrence[type] ?? 0) + 1;
    const nth = occurrence[type];

    if (type === "pull") {
      emphasis[day] = nth === 1
        ? "Pull A — strength emphasis: Vertical Pull at full volume (4 sets) with hard set; Horizontal Pull secondary (3 sets). Heavier, lower-rep focus."
        : "Pull B — volume/technique emphasis: Horizontal Pull featured at full volume (4 sets); Vertical Pull at moderate volume (3 sets), prefer explosive or technique-focused variation. Chin-up slot may substitute for Vertical Pull if present and level-appropriate.";
    } else if (type === "push") {
      emphasis[day] = nth === 1
        ? "Push A — strength emphasis: Vertical Push at full volume; Horizontal Push secondary. Hard set exposure included."
        : "Push B — volume emphasis: Dips at full volume (4 sets); Horizontal Push featured; Vertical Push at moderate volume (3 sets).";
    } else if (type === "legs") {
      emphasis[day] = nth === 1
        ? "Legs A — primary unilateral: main leg skill at full intensity; full unilateral volume."
        : "Legs B — posterior/supplemental: Nordic curls or hamstring work featured; lighter unilateral or calf volume.";
    }
  }
  return emphasis;
}

function computeWeeklyBalance(
  skillGoals:           SkillGoalContext[],
  primarySkillWorkOnly: boolean,
  daysPerWeek:          number,
): WeeklyBalanceGuide {
  return {
    goalFrequencies:    computeGoalFrequencies(skillGoals, primarySkillWorkOnly, daysPerWeek),
    overlapRisks:       detectOverlapRisks(skillGoals),
    sessionPriorityMap: buildSessionPriorityMap(skillGoals),
  };
}

// ─── Movement family groups ───────────────────────────────────────────────────
// When multiple workout slots belong to the same movement family (parallel
// progressions for the same fundamental pattern), the lower-level slot is
// marked as optional if it is significantly weaker than the dominant slot.
//
// "Vertical Pull" and "Chin-up" are the clearest example: both train vertical
// pulling but have separate chains in WORKOUT_CHAINS. A user at weighted pull-up
// should not be forced to fill a chin-up slot that sits at chin-up negative level.

// ─── Near-duplicate detection ─────────────────────────────────────────────────
// Two exercises are near-duplicates if they are:
//   (a) explicit peer alternatives (in each other's tree alternatives list), OR
//   (b) in the same named branch at a very close difficulty level (≤ 1 apart).
// These pairs should not be used in the same role within a session — but one as
// skill work and another as support, or a hard-set pair, are intentional and fine.

/**
 * Builds near-duplicate groups (transitive clusters) and the full pairwise list derived from them.
 *
 * Detection criteria (same as before):
 *   (a) Explicit peer alternatives (each other in TreeNode.alternatives), OR
 *   (b) Same named branch at difficulty ≤ 1 apart.
 *
 * Transitive closure: if A↔B and B↔C are both detected, the group is [A, B, C].
 * This prevents Gemini from removing B (to fix A+B pair) and substituting C.
 */
function computeNearDuplicateSets(poolNames: string[]): {
  groups: Array<string[]>;
  pairs:  Array<[string, string]>;
} {
  const n = poolNames.length;

  // Union-find (iterative path-compression, no nested closures)
  const parent = Array.from({ length: n }, (_, i) => i);
  function ufFind(x: number): number {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    // Path compression
    while (parent[x] !== root) { const next = parent[x]; parent[x] = root; x = next; }
    return root;
  }
  function ufUnion(x: number, y: number): void {
    parent[ufFind(x)] = ufFind(y);
  }

  for (let i = 0; i < n; i++) {
    const idA   = NAME_TO_ID.get(poolNames[i].toLowerCase());
    const nodeA = idA ? NODE_MAP.get(idA) : undefined;
    if (!nodeA) continue;
    for (let j = i + 1; j < n; j++) {
      const idB   = NAME_TO_ID.get(poolNames[j].toLowerCase());
      const nodeB = idB ? NODE_MAP.get(idB) : undefined;
      if (!nodeB) continue;

      const arePeerAlts =
        (idB !== undefined && (nodeA.alternatives?.includes(idB) ?? false)) ||
        (idA !== undefined && (nodeB.alternatives?.includes(idA) ?? false));

      const areSameBranchClose =
        nodeA.branch !== undefined &&
        nodeA.branch === nodeB.branch &&
        nodeA.difficulty !== undefined &&
        nodeB.difficulty !== undefined &&
        Math.abs(nodeA.difficulty - nodeB.difficulty) <= 1;

      if (arePeerAlts || areSameBranchClose) ufUnion(i, j);
    }
  }

  // Build groups from union-find roots
  const groupMap = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const root = ufFind(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(poolNames[i]);
  }
  const groups = Array.from(groupMap.values()).filter(g => g.length >= 2);

  // Derive all pairwise combos from groups (transitive closure)
  const pairs: Array<[string, string]> = [];
  for (const g of groups) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        pairs.push([g[i], g[j]]);
      }
    }
  }

  return { groups, pairs };
}

/**
 * Finds cross-slot near-duplicate clusters: exercises from *different* WorkoutSlots
 * (same session type) that are explicit peer alternatives to each other.
 * Same-branch closeness is intentionally excluded for cross-slot — exercises in
 * different chains at similar difficulty are not necessarily substitutable.
 */
function computeCrossSlotClusters(slots: WorkoutSlot[]): Array<string[]> {
  const allClusters: Array<string[]> = [];
  const sessionTypes = [...new Set(slots.map(s => s.session))] as Array<WorkoutSlot["session"]>;

  for (const sessionType of sessionTypes) {
    const sessionSlots = slots.filter(s => s.session === sessionType);
    if (sessionSlots.length < 2) continue;

    // Collect entries per slot index so we can require cross-slot pairing
    type Entry = { name: string; id: string; slotIdx: number };
    const entries: Entry[] = [];
    for (let si = 0; si < sessionSlots.length; si++) {
      for (const name of sessionSlots[si].allowedPool) {
        const id = NAME_TO_ID.get(name.toLowerCase());
        if (id) entries.push({ name, id, slotIdx: si });
      }
    }

    // Build clusters from cross-slot alternative pairs using set-merging
    type Cluster = { names: Set<string>; slots: Set<number> };
    const clusters: Cluster[] = [];

    for (let i = 0; i < entries.length; i++) {
      const nodeA = NODE_MAP.get(entries[i].id);
      if (!nodeA) continue;
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].slotIdx === entries[j].slotIdx) continue; // same slot — skip
        const nodeB = NODE_MAP.get(entries[j].id);
        if (!nodeB) continue;

        const arePeerAlts =
          (nodeA.alternatives?.includes(entries[j].id) ?? false) ||
          (nodeB.alternatives?.includes(entries[i].id) ?? false);
        if (!arePeerAlts) continue;

        const nameA = entries[i].name;
        const nameB = entries[j].name;

        // Merge into existing cluster or create new one
        const existingA = clusters.find(c => c.names.has(nameA));
        const existingB = clusters.find(c => c.names.has(nameB));

        if (existingA && existingB && existingA !== existingB) {
          for (const n of existingB.names) existingA.names.add(n);
          for (const s of existingB.slots) existingA.slots.add(s);
          clusters.splice(clusters.indexOf(existingB), 1);
        } else if (existingA) {
          existingA.names.add(nameB);
          existingA.slots.add(entries[j].slotIdx);
        } else if (existingB) {
          existingB.names.add(nameA);
          existingB.slots.add(entries[i].slotIdx);
        } else {
          clusters.push({
            names: new Set([nameA, nameB]),
            slots: new Set([entries[i].slotIdx, entries[j].slotIdx]),
          });
        }
      }
    }

    for (const c of clusters) {
      if (c.names.size >= 2) allClusters.push([...c.names]);
    }
  }

  return allClusters;
}

interface SlotFamilyGroup {
  /** Human-readable family name for skip reason messages */
  family:   string;
  /** Exact WORKOUT_CHAINS label strings that belong to this family */
  patterns: string[];
}

const SLOT_FAMILY_GROUPS: SlotFamilyGroup[] = [
  { family: "Vertical Pull", patterns: ["Vertical Pull", "Chin-up"] },
];

// How many difficulty levels below the dominant slot makes a family member optional.
// Gap < threshold → both slots have similar training value, include both.
// Gap ≥ threshold → lower slot is significantly weaker, mark skippable.
const SLOT_SKIP_THRESHOLD = 3;

/**
 * Looks up a node's difficulty by its display name.
 * Returns undefined when the node doesn't have difficulty metadata.
 */
function getDifficultyByName(name: string): number | undefined {
  for (const node of NODE_MAP.values()) {
    if (node.name === name) return node.difficulty;
  }
  return undefined;
}

/**
 * Post-processes built workout slots to mark lower-value family members as
 * optional. Mutates the skipReason field on affected slots in-place.
 */
function applySlotFamilySkipReasons(workoutSlots: WorkoutSlot[]): void {
  for (const { family, patterns } of SLOT_FAMILY_GROUPS) {
    const familySlots = workoutSlots.filter(s => patterns.includes(s.pattern));
    if (familySlots.length < 2) continue; // only one slot from this family present

    // Find the slot with the highest working-set difficulty
    let maxDiff    = -1;
    let dominant: WorkoutSlot | null = null;
    for (const slot of familySlots) {
      const diff = getDifficultyByName(slot.workingSet);
      if (diff !== undefined && diff > maxDiff) {
        maxDiff   = diff;
        dominant  = slot;
      }
    }
    if (!dominant || maxDiff < 0) continue;

    // Mark any slot whose working set is SLOT_SKIP_THRESHOLD or more levels lower
    for (const slot of familySlots) {
      if (slot === dominant) continue;
      const diff = getDifficultyByName(slot.workingSet);
      const gap  = diff !== undefined ? maxDiff - diff : 0;
      if (gap >= SLOT_SKIP_THRESHOLD) {
        slot.skipReason =
          `lower-value ${family} alternative: "${slot.pattern}" working set (${slot.workingSet}) ` +
          `is ${gap} difficulty levels below "${dominant.pattern}" (${dominant.workingSet}). ` +
          `Skip this slot entirely when session volume is at budget or the pattern is already ` +
          `well covered by the dominant slot.`;
      }
    }
  }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildPlannerInput(
  pullUps:            number,
  pushUps:            number,
  dips:               number,
  goal:               Goal,
  daysPerWeek:        number,
  equipment:          string[],
  weekNumber:         number,
  skillGoals:         SkillGoal[],
  progressMap:        Record<string, string>,
  eq:                 Set<EquipmentTag>,
  recentHistory:      string,
  sessionLength       = "60",
  performanceSignals  = "",
): PlannerInput {
  const goalLabel = goal === "build-strength" ? "Build Strength"
    : goal === "build-muscle" ? "Build Muscle"
    : "Build Strength & Muscle";

  const repScheme = goal === "build-muscle"
    ? "3–4 sets × 8–15 reps"
    : goal === "build-strength"
    ? "3–5 sets × 3–8 reps"
    : "3–5 sets × 5–10 reps";

  const clamped = Math.min(6, Math.max(1, daysPerWeek));
  const schedule = SCHEDULES[clamped] ?? SCHEDULES[3];

  const { min, max, skillWorkCapacity, primarySkillWorkOnly } = volumeFromSessionLength(sessionLength);
  const dedicatedCounts = countDedicatedSessions(schedule);

  // ── Workout slots ──────────────────────────────────────────────────────────
  const workoutSlots: WorkoutSlot[] = [];

  for (const wc of WORKOUT_CHAINS) {
    if (wc.label === "Nordic Curls" && !eq.has("anchor")) continue;

    // Equipment-filter the chain
    const available = wc.exercises.filter(ex =>
      ex.equipment.length === 0 || ex.equipment.every(t => eq.has(t))
    );
    if (available.length === 0) continue;

    const availableIds = available.map(e => e.id);

    // Current position: progress map → rep-count heuristic → first available
    let currentId = findCurrentInChain(availableIds, progressMap);
    if (!currentId) {
      const fbId = repCountFallbackId(wc.label, pullUps, pushUps, dips);
      currentId = (fbId && availableIds.includes(fbId)) ? fbId : availableIds[0];
    }

    const currentIdx = availableIds.indexOf(currentId);
    const workingSet = available[currentIdx].name;
    const hardSet    = currentIdx < available.length - 1
      ? available[currentIdx + 1].name
      : null;

    // Peer alternatives: same-difficulty options for the working-set node,
    // filtered to equipment the user actually has.
    const currentNode = NODE_MAP.get(currentId);
    const currentDiff = currentNode?.difficulty;
    const peerAlternatives: string[] = [];
    for (const altId of currentNode?.alternatives ?? []) {
      const altNode = NODE_MAP.get(altId);
      if (!altNode) continue;
      const hasEquip = !altNode.equipment || altNode.equipment.length === 0 ||
                       altNode.equipment.every(t => eq.has(t));
      if (hasEquip) peerAlternatives.push(altNode.name);
    }

    // ── Level filter ──────────────────────────────────────────────────────────
    // Exercises more than REGRESSION_THRESHOLD difficulty levels below the working
    // set are moved to regressedPool and excluded from allowedPool entirely.
    // This prevents Gemini from picking clearly regressed exercises as support work,
    // and allows the validator to catch any violations.
    // Falls back to positional proximity when difficulty data is missing.
    const REGRESSION_THRESHOLD = 2;
    const levelFiltered: typeof available = [];
    const regressedEntries: typeof available = [];
    for (const ex of available) {
      const exNode = NODE_MAP.get(ex.id);
      const exDiff = exNode?.difficulty;
      const isWithinLevel =
        currentDiff !== undefined && exDiff !== undefined
          ? exDiff >= currentDiff - REGRESSION_THRESHOLD
          : availableIds.indexOf(ex.id) >= currentIdx - REGRESSION_THRESHOLD;
      (isWithinLevel ? levelFiltered : regressedEntries).push(ex);
    }

    // allowedPool = level-filtered chain names + peer alternatives.
    // Peer alternatives are always included (same difficulty as working set).
    const basePool      = levelFiltered.map(e => e.name);
    const augmentedPool = [...basePool];
    for (const alt of peerAlternatives) {
      if (!augmentedPool.includes(alt)) augmentedPool.push(alt);
    }

    // regressedPool = excluded names, for validation diagnostics only.
    const regressedPool = regressedEntries.map(e => e.name);

    // suggestedSupportRange = exercises within ±2 difficulty of working set, from
    // the already-filtered pool. This caps the upper end for support/accessory
    // work — harder exercises are in allowedPool for hard-set use but shouldn't
    // be chosen as routine support lifts.
    const suggestedSupportRange: string[] = [];
    for (const ex of levelFiltered) {
      const exNode = NODE_MAP.get(ex.id);
      const exDiff = exNode?.difficulty;
      if (currentDiff !== undefined && exDiff !== undefined) {
        if (Math.abs(exDiff - currentDiff) <= 2) suggestedSupportRange.push(ex.name);
      } else {
        const pos = availableIds.indexOf(ex.id);
        if (Math.abs(pos - currentIdx) <= 2) suggestedSupportRange.push(ex.name);
      }
    }
    for (const alt of peerAlternatives) {
      if (!suggestedSupportRange.includes(alt)) suggestedSupportRange.push(alt);
    }

    const { pairs: slotDupePairs, groups: slotDupeGroups } = computeNearDuplicateSets(augmentedPool);
    workoutSlots.push({
      pattern:              wc.label,
      session:              wc.session,
      workingSet,
      hardSet,
      allowedPool:          augmentedPool,
      peerAlternatives,
      regressedPool,
      suggestedSupportRange,
      skipReason:           null, // may be set by applySlotFamilySkipReasons below
      nearDuplicatePairs:   slotDupePairs,
      nearDuplicateGroups:  slotDupeGroups,
    });
  }

  // Post-process: mark same-family slots that are significantly below the dominant
  // slot as optional. Must happen after all slots are pushed.
  applySlotFamilySkipReasons(workoutSlots);

  // ── Skill goal contexts ────────────────────────────────────────────────────
  const skillGoalContexts: SkillGoalContext[] = skillGoals.map((sg, idx) => {
    const goalEntry   = PRO_GOAL_MAP.get(sg.skill_name as Parameters<typeof PRO_GOAL_MAP.get>[0]);
    const label       = goalEntry?.label
      ?? sg.skill_name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const session     = SKILL_SESSION[sg.skill_name] ?? "pull";
    const nextNodeId  = findNextSkillStep(sg.current_progression);
    const currentNode = NODE_MAP.get(sg.current_progression);
    const nextNode    = nextNodeId ? NODE_MAP.get(nextNodeId) : null;

    const terminalNodeId = goalEntry?.terminalNodeId ?? sg.skill_name;

    // Build full chain and locate current position for support-context derivation
    const chain      = getSkillChain(terminalNodeId);
    const currentIdx = chain.indexOf(sg.current_progression);

    return {
      goalId:            sg.skill_name,
      goalLabel:         label,
      session,
      priority:          idx + 1,
      currentStepName:   currentNode?.name ?? sg.current_progression,
      currentStepNodeId: sg.current_progression,
      terminalNodeId,
      prescription:      extractPrescription(sg.current_progression),
      advanceCondition:  extractAdvanceCondition(sg.current_progression, nextNodeId),
      nextStepName:      nextNode?.name ?? null,
      weeklyDedicatedSessions: dedicatedCounts[session] ?? 0,
      support:           buildSupportContext(sg.skill_name, chain, currentIdx, progressMap, workoutSlots, eq),
    };
  });

  const weeklyBalance  = computeWeeklyBalance(skillGoalContexts, primarySkillWorkOnly, clamped);
  const sessionEmphasis = buildSessionEmphasis(schedule);
  const sessionNearDuplicateClusters = computeCrossSlotClusters(workoutSlots);

  return {
    weekNumber,
    goalLabel,
    repScheme,
    daysPerWeek: clamped,
    schedule,
    equipment,
    sessionLength,
    volumePerSession:     { min, max },
    skillWorkCapacity,
    primarySkillWorkOnly,
    workoutSlots,
    skillGoals:           skillGoalContexts,
    weeklyBalance,
    recentHistory,
    performanceSignals,
    sessionEmphasis,
    sessionNearDuplicateClusters,
  };
}

// ─── Swap options resolver ────────────────────────────────────────────────────
// Deterministically derives easier/harder/alternative swaps for a single exercise.
//
// For skill work (isSkillWork = true):
//   Uses the goal's full progression chain. Easier = up to 2 steps back from the
//   user's current step. Harder = up to 2 steps forward. Alternatives = peer
//   nodes listed in TreeNode.alternatives (same difficulty, different variation).
//
// For regular exercises (isSkillWork = false):
//   Uses the WorkoutSlot.allowedPool (ordered easiest→hardest). Position in the
//   pool gives easier/harder. Alternatives from the node's alternatives field.
//
// Returns undefined when the exercise cannot be located in any known pool
// (e.g. core filler exercises with no progression chain).

export function resolveSwapOptions(
  exerciseName: string,
  isSkillWork:  boolean,
  input:        PlannerInput,
): SwapOptions | undefined {
  const nameLower = exerciseName.toLowerCase();

  if (isSkillWork) {
    // Find the skill goal whose currentStepName matches this exercise
    const goal = input.skillGoals.find(
      sg => sg.currentStepName.toLowerCase() === nameLower,
    );
    if (!goal) return undefined;

    const chain = getSkillChain(goal.terminalNodeId);
    const idx   = chain.indexOf(goal.currentStepNodeId);
    if (idx === -1) return undefined;

    const easierIds = chain.slice(Math.max(0, idx - 2), idx);
    const harderIds = chain.slice(idx + 1, Math.min(chain.length, idx + 3));

    const node    = NODE_MAP.get(goal.currentStepNodeId);
    const altIds  = node?.alternatives ?? [];

    return {
      easier:       easierIds.map(id => NODE_MAP.get(id)?.name).filter((n): n is string => !!n),
      harder:       harderIds.map(id => NODE_MAP.get(id)?.name).filter((n): n is string => !!n),
      alternatives: altIds.map(id => NODE_MAP.get(id)?.name).filter((n): n is string => !!n),
    };
  }

  // Regular exercise — find the WorkoutSlot whose allowedPool contains this name
  const slot = input.workoutSlots.find(s =>
    s.allowedPool.some(n => n.toLowerCase() === nameLower),
  );
  if (!slot) return undefined;

  const idx = slot.allowedPool.findIndex(n => n.toLowerCase() === nameLower);
  if (idx === -1) return undefined;

  const easier = slot.allowedPool.slice(Math.max(0, idx - 2), idx);
  const harder = slot.allowedPool.slice(idx + 1, Math.min(slot.allowedPool.length, idx + 3));

  // Peer alternatives: find the node by name and read its alternatives field
  let alternatives: string[] = [];
  for (const node of NODE_MAP.values()) {
    if (node.name.toLowerCase() === nameLower && node.alternatives) {
      alternatives = node.alternatives
        .map(id => NODE_MAP.get(id)?.name)
        .filter((n): n is string => !!n);
      break;
    }
  }

  // Only return if there's at least something useful to show
  if (easier.length === 0 && harder.length === 0 && alternatives.length === 0) return undefined;

  return { easier, harder, alternatives };
}
