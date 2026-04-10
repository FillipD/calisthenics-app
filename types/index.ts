// types/index.ts
// Shared TypeScript types used across the app

// ─── Skill tree ───────────────────────────────────────────────────────────────
export type ProgressStatus = "current" | "completed";
export type VisualState    = "current" | "completed" | "locked" | "reachable";
export type NodePos        = { x: number; y: number };

// ─── Fitness plan ─────────────────────────────────────────────────────────────
export type Goal =
  | "build-strength"
  | "build-muscle"
  | "build-strength-muscle";

export type Level = "Beginner" | "Beginner+" | "Intermediate" | "Advanced";

// What the user submits in the form
export interface FormData {
  pullUps: number;
  pushUps: number;
  dips: number;
  goal: Goal;
  daysPerWeek: number;
  equipment: string[];
  email: string;
}

// What the server returns after processing
export interface AssessmentResult {
  level: Level;
  summary: string;
  plan: WeeklyPlan;
}

// Easier / harder / peer alternatives for an exercise in a generated plan.
// All names are human-readable (matching Exercise.name), not node IDs.
// Derived deterministically from the skill tree and planner input — never from AI.
export interface SwapOptions {
  /** Up to 2 easier steps in the same progression chain or movement slot */
  easier:       string[];
  /** Up to 2 harder steps in the same progression chain or movement slot */
  harder:       string[];
  /** Peer-level same-difficulty alternatives (different variation, same pattern) */
  alternatives: string[];
}

// One exercise in a session
export interface Exercise {
  name: string;
  sets: number;
  reps: string;             // e.g. "8-12" or "Max"
  isHardSet: boolean;       // true = working toward next step, false = consolidating current
  isSkillWork?: boolean;    // true = part of skill goal training block
  progressionNote?: string; // optional hint shown below exercise name
  swapOptions?: SwapOptions; // deterministic easier/harder/alternative swaps
}

// One day in the week (training or rest)
export interface TrainingDay {
  day: string;        // e.g. "Monday"
  type: "training" | "rest";
  focus?: string;     // only for training days
  exercises?: Exercise[]; // only for training days
  skillWork?: Exercise[]; // optional skill work block (pull/push days: before; legs days: after)
}

// Skill goal stored in user_skills table
export interface SkillGoal {
  skill_name: string;          // ProGoalId for the 7 known goals (e.g. "muscle-up", "front-lever");
                               // terminal node id for unmapped goals (e.g. "one-arm-pullup")
  current_progression: string; // e.g. "tuck-fl" — the node the user is currently working on
}

// Progress entry from user_progress table (used by skill tree UI)
export interface UserProgress {
  node_id: string;
  status: string; // "current" | "completed"
}

// The full 1-week plan
export interface WeeklyPlan {
  days: TrainingDay[];
  note: string;
}

// ─── Pro onboarding ───────────────────────────────────────────────────────────

export type ProGoalId =
  | 'muscle-up'
  | 'front-lever'
  | 'back-lever'
  | 'handstand'
  | 'handstand-pushup'
  | 'l-sit'
  | 'pistol-squat'
  | 'planche'
  | 'shrimp-squat'
  | 'ring-muscle-up'

export type SessionLength = '30' | '45' | '60' | '90'
export type TrainingEmphasis = 'strength' | 'muscle' | 'balanced'

/**
 * Full capability snapshot collected during pro onboarding.
 * Goal-specific fields default to 0 when not assessed (goal was not selected).
 */
export interface ProOnboardingData {
  // Goals
  primaryGoal:    ProGoalId
  secondaryGoals: ProGoalId[]

  // Schedule & preferences
  equipment:     string[]
  trainingDays:  number            // 1–6
  sessionLength: SessionLength     // minutes per session
  emphasis:      TrainingEmphasis

  // Base strength — collected for every pro user
  pullUpsMax:  number
  pushUpsMax:  number
  dipsMax:     number

  // Goal-specific assessments — collected only when the relevant goal is selected
  activeHangSeconds:      number  // scapular hang hold  (muscle-up, front lever, back lever)
  deadHangSeconds:        number  // passive hang hold   (muscle-up, front lever, back lever)
  skinTheCat:             number  // reps                (back lever)
  tuckFrontLeverSeconds:  number  // tuck FL hold        (front lever)
  oneLegFLSeconds:        number  // one-leg FL hold     (front lever)
  straddleFLSeconds:      number  // straddle FL hold    (front lever)
  tuckBackLeverSeconds:   number  // tuck BL hold        (back lever)
  advTuckBLSeconds:       number  // advanced tuck BL hold (back lever)
  oneLegBLSeconds:        number  // one-leg BL hold     (back lever)
  wallHandstandSeconds:         number  // chest-to-wall hold      (handstand, HSPU)
  freestandingHandstandSeconds: number  // freestanding hold       (handstand)
  pikePushUpsMax:         number  // reps                (HSPU)
  lSitSeconds:            number  // best hold           (L-sit)
  pistolSquatAssisted:    number  // reps with support   (pistol squat)
  pistolSquatFull:        number  // unassisted reps     (pistol squat)
  plancheLeanSeconds:     number  // planche lean hold   (planche)
  frogStandSeconds:       number  // frog stand hold     (planche)
  tuckPlancheSeconds:     number  // tuck planche hold   (planche)
  shrimpSquatAssisted:    number  // reps with support   (shrimp squat)
  shrimpSquatFull:        number  // unassisted reps     (shrimp squat)
  falseGripHangSeconds:   number  // false grip hang hold (ring muscle-up)
  falseGripPullUpsMax:    number  // false grip pull-ups  (ring muscle-up)
  ringDipsMax:            number  // ring dip reps        (ring muscle-up)
  ringSupportHoldSeconds: number  // ring support hold    (ring muscle-up)
}

// ─── Pro onboarding v2 ────────────────────────────────────────────────────────
// Redesigned model: two-stage assessment (global benchmarks → goal refinement).
//
// Goals:
//   - Ask questions the user can actually answer (reps, yes/no, level selects)
//   - Cover the whole tree broadly, not just selected goal branches
//   - Replace exact hold-second fields with milestone selects
//
// ProOnboardingData (above) is kept as the legacy v1 interface.

// ── Milestone / level types ───────────────────────────────────────────────────
// Replace exact hold-time number fields throughout. Users know "I can hold a
// tuck front lever" much more reliably than "I can hold it for 8 seconds".

/** L-sit capability level — replaces lSitSeconds */
export type LSitLevel =
  | 'none'       // cannot hold an L-sit
  | 'brief'      // < 5s
  | '5s'         // 5–9s (goal: l-sit-full ≥ 5s)
  | '10s'        // 10–29s
  | '30s'        // 30s+ (goal achieved)

/** Front lever highest holdable variation */
export type FrontLeverLevel =
  | 'none'       // cannot hold a tuck front lever for 3s
  | 'tuck'       // can hold tuck FL
  | 'one-leg'    // can hold one-leg FL
  | 'straddle'   // can hold straddle FL
  | 'full'       // can hold full FL

/** Back lever highest holdable variation */
export type BackLeverLevel =
  | 'none'       // cannot hold any back lever (tuck or above)
  | 'tuck'       // can hold tuck back lever
  | 'adv-tuck'   // can hold advanced tuck BL
  | 'one-leg'    // can hold one-leg BL
  | 'full'       // can hold full BL

/** Handstand progression level */
export type HandstandLevel =
  | 'none'           // cannot hold a chest-to-wall handstand
  | 'wall'           // can hold chest-to-wall, not yet kicking to freestanding
  | 'kick-balance'   // can kick to brief freestanding balance
  | 'freestanding'   // solid freestanding (10s+)

/** Planche highest holdable position */
export type PlancheLevel =
  | 'none'       // cannot hold a planche lean for 15s
  | 'lean'       // can hold planche lean
  | 'frog'       // can hold frog stand
  | 'tuck'       // can hold tuck planche
  | 'adv-tuck'   // can hold advanced tuck planche

/** Ring muscle-up chain position */
export type RingMULevel =
  | 'none'               // not yet working false-grip
  | 'false-grip-hang'    // working on false-grip hang
  | 'false-grip-pullup'  // can false-grip hang, working on pull-ups
  | 'ring-negative'      // can do false-grip pull-ups, working on ring negatives
  | 'ring-mu'            // can do ring muscle-ups

/** Pistol squat level */
export type PistolSquatLevel =
  | 'none'       // cannot do any pistol variation
  | 'assisted'   // hand-assisted pistol
  | 'elevated'   // box/elevated pistol
  | 'full'       // full unassisted pistol

/** Shrimp squat level */
export type ShrimpSquatLevel =
  | 'none'       // cannot do any shrimp variation
  | 'assisted'   // holding support for balance
  | 'free'       // no support, working on consistency
  | 'full'       // solid unassisted reps (5+)

// ── Global benchmarks ─────────────────────────────────────────────────────────
// Collected for every pro user. Covers the whole tree broadly.
// All fields use simple reps, yes/no, or milestone selects — no stopwatch needed.

export interface GlobalBenchmarks {
  // Schedule & preferences (same as v1)
  equipment:     string[]
  trainingDays:  number
  sessionLength: SessionLength
  emphasis:      TrainingEmphasis

  // Strength benchmarks — reps are easy to self-report accurately
  pullUpsMax:       number   // 0 = cannot do one
  pushUpsMax:       number   // 0 = cannot do one
  dipsMax:          number   // 0 = cannot do one
  pikePushUpsMax:   number   // 0 = cannot do one; fills pike chain for HSPU/handstand

  // Skill checkpoints — yes/no or milestone; no stopwatch required
  canSkinTheCat:        boolean    // can complete a full skin-the-cat rotation
  wallHandstandAny:     boolean    // can hold any chest-to-wall handstand
  pistolSquatAny:       boolean    // can do any pistol squat (assisted counts)
  hangingLegRaisesMax:  number     // 0 = cannot do any; fills leg-raise chain
  lSitLevel:            LSitLevel  // fills L-sit chain for everyone, not just L-sit goal users
}

// ── Goal-specific refinement ──────────────────────────────────────────────────
// Only collected for selected goals. Each goal needs at most 1–2 extra questions.
// Muscle-up and L-sit need no refinement (fully inferred from global benchmarks).

export interface GoalRefinementData {
  frontLeverLevel:  FrontLeverLevel   // front-lever goal
  backLeverLevel:   BackLeverLevel    // back-lever goal
  handstandLevel:   HandstandLevel    // handstand / handstand-pushup goal
  plancheLevel:     PlancheLevel      // planche goal
  ringMULevel:      RingMULevel       // ring-muscle-up goal
  ringDipsMax:      number            // ring dips reps — ring-muscle-up push prerequisite
  pistolSquatLevel: PistolSquatLevel  // pistol-squat goal (refines pistolSquatAny)
  shrimpSquatLevel: ShrimpSquatLevel  // shrimp-squat goal
}

// ── Full v2 payload ───────────────────────────────────────────────────────────

export interface ProOnboardingDataV2 {
  primaryGoal:    ProGoalId
  secondaryGoals: ProGoalId[]
  benchmarks:     GlobalBenchmarks
  /** Partial — only fields for selected goals are collected and meaningful. */
  refinement:     Partial<GoalRefinementData>
}
