// lib/proOnboardingV2.ts
// Pro onboarding v2 — question definitions for the redesigned two-stage model.
//
// Stage 1 — Global benchmarks (everyone answers these):
//   Goals → Schedule → Broad fitness benchmarks
//   Covers the whole tree: pull, push, legs, core, skill checkpoints.
//   Uses reps, yes/no, or milestone selects — no stopwatch needed.
//
// Stage 2 — Goal refinement (only for selected goals):
//   1–2 questions per goal, milestone-based.
//   Muscle-up and L-sit need NO refinement (fully inferred from global benchmarks).
//
// This file is the v2 counterpart to lib/proOnboarding.ts.
// The legacy system remains unchanged and functional until the UI is migrated.

import type {
  ProGoalId,
  SessionLength,
  TrainingEmphasis,
  LSitLevel,
  FrontLeverLevel,
  BackLeverLevel,
  HandstandLevel,
  PlancheLevel,
  RingMULevel,
  PistolSquatLevel,
  ShrimpSquatLevel,
  GlobalBenchmarks,
  GoalRefinementData,
} from '@/types'
import { PRO_GOALS, type ProGoal } from '@/lib/proOnboarding'

export type GoalCategory = 'pull' | 'push' | 'legs' | 'core'

// ─── Question definition ──────────────────────────────────────────────────────

export interface BenchmarkQuestion {
  /** Maps to a field in GlobalBenchmarks */
  id:        keyof GlobalBenchmarks
  label:     string
  helpText?: string
  inputType: 'number' | 'boolean' | 'select' | 'multiselect'
  unit?:     string
  min?:      number
  choices?:  { value: string; label: string }[]
}

export interface RefinementQuestion {
  /** Maps to a field in GoalRefinementData */
  id:        keyof GoalRefinementData
  label:     string
  helpText?: string
  inputType: 'number' | 'select'
  unit?:     string
  min?:      number
  choices?:  { value: string; label: string }[]
  goals:     ProGoalId[]
}

// ─── Stage 1a — Schedule questions ───────────────────────────────────────────
// Identical in structure to v1 but typed against GlobalBenchmarks.

const EQUIPMENT_CHOICES = [
  { value: 'Pull-up bar',              label: 'Pull-up bar' },
  { value: 'Parallel bars / dip bars', label: 'Parallel bars / dip bars' },
  { value: 'Rings',                    label: 'Rings' },
  { value: 'Parallettes',              label: 'Parallettes' },
  { value: 'Resistance bands',         label: 'Resistance bands' },
  { value: 'Nordic curl anchor',       label: 'Nordic curl anchor' },
  { value: 'Weights (belt or vest)',   label: 'Weights (belt or vest)' },
]

export const SCHEDULE_QUESTIONS: BenchmarkQuestion[] = [
  {
    id:        'equipment',
    label:     'What equipment do you have access to?',
    helpText:  'Select all that apply. This affects which exercises get included in your plan.',
    inputType: 'multiselect',
    choices:   EQUIPMENT_CHOICES,
  },
  {
    id:        'trainingDays',
    label:     'How many days per week can you train?',
    helpText:  'Enter a number from 1 to 6.',
    inputType: 'number',
    min:       1,
  },
  {
    id:        'sessionLength',
    label:     'How long is a typical session?',
    helpText:  'Approximate is fine — this shapes how much volume fits in each day.',
    inputType: 'select',
    choices: [
      { value: '30', label: '30 minutes' },
      { value: '45', label: '45 minutes' },
      { value: '60', label: '60 minutes' },
      { value: '90', label: '90+ minutes' },
    ] satisfies { value: SessionLength; label: string }[],
  },
  {
    id:        'emphasis',
    label:     'What do you want to prioritise?',
    helpText:  'This affects rep ranges and how volume is distributed across your plan.',
    inputType: 'select',
    choices: [
      { value: 'strength', label: 'Strength — lower reps, heavier progressions' },
      { value: 'muscle',   label: 'Muscle — higher volume, hypertrophy focus' },
      { value: 'balanced', label: 'Balanced — mix of strength and muscle work' },
    ] satisfies { value: TrainingEmphasis; label: string }[],
  },
]

// ─── Stage 1b — Global benchmark questions ───────────────────────────────────
// 9 questions covering the whole tree. Everyone answers all of these.
// Split into two sub-steps so no single page dumps >5 questions on the user:
//   - STRENGTH_BENCHMARK_QUESTIONS: 5 rep-count questions (pull, push, dips,
//     pike push-ups, hanging leg raises). Fast, confidence-building.
//   - SKILL_BENCHMARK_QUESTIONS: 4 skill checkpoints (yes/no + L-sit select).
// BENCHMARK_QUESTIONS remains exported as the concatenation for any consumer
// that wants the full list.

export const STRENGTH_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id:        'pullUpsMax',
    label:     'How many pull-ups can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Full dead hang to chin over bar — enter 0 if you cannot do one yet',
  },
  {
    id:        'pushUpsMax',
    label:     'How many push-ups can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Full range, chest to floor — enter 0 if you cannot do one yet',
  },
  {
    id:        'dipsMax',
    label:     'How many dips can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Parallel bars or rings, full range — enter 0 if you cannot do one yet',
  },
  {
    id:        'pikePushUpsMax',
    label:     'How many pike push-ups can you do?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Hips high, head between arms, nose toward floor — enter 0 if not possible yet',
  },
  {
    id:        'hangingLegRaisesMax',
    label:     'How many hanging leg raises can you do?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Straight legs raised to at least horizontal, from a dead hang. Enter 0 if you can only do knee raises or not yet.',
  },
]

export const SKILL_BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  {
    id:        'canSkinTheCat',
    label:     'Can you complete a skin-the-cat?',
    inputType: 'boolean',
    helpText:  'Full rotation: hang → tuck through → german hang → back to hang',
  },
  {
    id:        'wallHandstandAny',
    label:     'Can you hold a chest-to-wall handstand?',
    inputType: 'boolean',
    helpText:  'Any hold at all — belly facing the wall, body roughly straight',
  },
  {
    id:        'pistolSquatAny',
    label:     'Can you do a pistol squat?',
    inputType: 'boolean',
    helpText:  'Any variation counts — assisted with a support is fine',
  },
  {
    id:        'lSitLevel',
    label:     'What best describes your L-sit?',
    inputType: 'select',
    choices: [
      { value: 'none',  label: 'Cannot hold one yet' },
      { value: 'brief', label: 'Brief hold (under 5 seconds)' },
      { value: '5s',    label: 'Around 5 seconds' },
      { value: '10s',   label: '10 seconds or more' },
      { value: '30s',   label: '30 seconds or more' },
    ] satisfies { value: LSitLevel; label: string }[],
  },
]

export const BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  ...STRENGTH_BENCHMARK_QUESTIONS,
  ...SKILL_BENCHMARK_QUESTIONS,
]

// ─── Stage 2 — Goal refinement questions ─────────────────────────────────────
// 1–2 questions per goal. Only shown when the goal is selected.
// Milestone selects replace the multiple exact-second fields from v1.
//
// Goals with NO refinement questions (fully inferred from global benchmarks):
//   muscle-up     — pullUpsMax + dipsMax is sufficient
//   l-sit         — lSitLevel covers the whole chain
//   pistol-squat  — pistolSquatAny + pistolSquatLevel

const REFINEMENT_QUESTIONS: RefinementQuestion[] = [
  // ── Front lever ─────────────────────────────────────────────────────────────
  {
    id:        'frontLeverLevel',
    label:     'Which front lever variation can you hold for at least 3 seconds?',
    inputType: 'select',
    goals:     ['front-lever'],
    choices: [
      { value: 'none',     label: 'None yet — working up to it' },
      { value: 'tuck',     label: 'Tuck front lever' },
      { value: 'one-leg',  label: 'One-leg front lever' },
      { value: 'straddle', label: 'Straddle front lever' },
      { value: 'full',     label: 'Full front lever' },
    ] satisfies { value: FrontLeverLevel; label: string }[],
  },

  // ── Back lever ──────────────────────────────────────────────────────────────
  {
    id:        'backLeverLevel',
    label:     'Which back lever position can you hold for at least 5 seconds?',
    inputType: 'select',
    goals:     ['back-lever'],
    helpText:  'Pick the highest position you can hold. If you can only do skin-the-cat, pick "None yet".',
    choices: [
      { value: 'none',     label: 'None yet — still working on skin-the-cat / german hang' },
      { value: 'tuck',     label: 'Tuck back lever' },
      { value: 'adv-tuck', label: 'Advanced tuck back lever (thighs parallel to floor)' },
      { value: 'one-leg',  label: 'One-leg back lever' },
      { value: 'full',     label: 'Full back lever' },
    ] satisfies { value: BackLeverLevel; label: string }[],
  },

  // ── Handstand / HSPU ────────────────────────────────────────────────────────
  {
    id:        'handstandLevel',
    label:     'What best describes your handstand?',
    inputType: 'select',
    goals:     ['handstand', 'handstand-pushup'],
    choices: [
      { value: 'none',          label: 'Cannot hold a chest-to-wall handstand yet' },
      { value: 'wall',          label: 'Can hold chest-to-wall for 30+ seconds' },
      { value: 'kick-balance',  label: 'Can kick up and hold a freestanding balance (briefly)' },
      { value: 'freestanding',  label: 'Consistent freestanding handstand (10+ seconds)' },
    ] satisfies { value: HandstandLevel; label: string }[],
  },

  // ── Planche ─────────────────────────────────────────────────────────────────
  {
    id:        'plancheLevel',
    label:     'Which planche position can you hold for at least 3 seconds?',
    inputType: 'select',
    goals:     ['planche'],
    choices: [
      { value: 'none',     label: 'None yet — planche lean not yet solid' },
      { value: 'lean',     label: 'Planche lean (arms straight, leaning forward)' },
      { value: 'frog',     label: 'Frog stand (knees on elbows)' },
      { value: 'tuck',     label: 'Tuck planche (hips above hands, knees tucked)' },
      { value: 'adv-tuck', label: 'Advanced tuck planche' },
    ] satisfies { value: PlancheLevel; label: string }[],
  },

  // ── Ring muscle-up ──────────────────────────────────────────────────────────
  {
    id:        'ringMULevel',
    label:     'Where are you in the ring muscle-up progression?',
    helpText:  'Pick the highest step you can currently do. These build sequentially.',
    inputType: 'select',
    goals:     ['ring-muscle-up'],
    choices: [
      { value: 'none',               label: 'Not started — new to false grip' },
      { value: 'false-grip-hang',    label: 'Working on false-grip hang (wrist over ring)' },
      { value: 'false-grip-pullup',  label: 'Can false-grip hang, working on pull-ups' },
      { value: 'ring-negative',      label: 'Can do false-grip pull-ups, working on ring negatives' },
      { value: 'ring-mu',            label: 'Can do ring muscle-ups' },
    ] satisfies { value: RingMULevel; label: string }[],
  },
  {
    id:        'ringDipsMax',
    label:     'How many ring dips can you do?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    goals:     ['ring-muscle-up'],
    helpText:  'Full range of motion, rings turned out at the top — 0 if not yet possible',
  },

  // ── Pistol squat ────────────────────────────────────────────────────────────
  {
    id:        'pistolSquatLevel',
    label:     'Which pistol squat variation can you do?',
    inputType: 'select',
    goals:     ['pistol-squat'],
    choices: [
      { value: 'none',     label: 'None yet — still building single-leg strength' },
      { value: 'assisted', label: 'Hand-assisted pistol (holding a support)' },
      { value: 'elevated', label: 'Elevated pistol (foot on a box or step)' },
      { value: 'full',     label: 'Full unassisted pistol squat' },
    ] satisfies { value: PistolSquatLevel; label: string }[],
  },

  // ── Shrimp squat ────────────────────────────────────────────────────────────
  {
    id:        'shrimpSquatLevel',
    label:     'Which shrimp squat variation can you do?',
    inputType: 'select',
    goals:     ['shrimp-squat'],
    helpText:  'One leg, back foot held behind you — different from a pistol squat.',
    choices: [
      { value: 'none',     label: 'None yet — still building single-leg balance' },
      { value: 'assisted', label: 'Assisted (holding a support for balance)' },
      { value: 'free',     label: 'Free — no support, working on consistency' },
      { value: 'full',     label: 'Solid unassisted reps (5+)' },
    ] satisfies { value: ShrimpSquatLevel; label: string }[],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Goal selection questions — same shape as v1 but returned separately. */
export const GOAL_SELECTION_QUESTIONS = {
  primaryGoal: {
    id:        'primaryGoal' as const,
    label:     'What is your primary goal?',
    inputType: 'select'  as const,
    choices:   PRO_GOALS.map(g => ({ value: g.id, label: g.label })),
  },
  secondaryGoals: {
    id:        'secondaryGoals' as const,
    label:     'Any other goals you want to work toward? (optional)',
    inputType: 'multiselect' as const,
    choices:   PRO_GOALS.map(g => ({ value: g.id, label: g.label })),
  },
}

/** Returns all global benchmark questions (schedule + fitness). */
export function getGlobalBenchmarkQuestions(): BenchmarkQuestion[] {
  return [...SCHEDULE_QUESTIONS, ...BENCHMARK_QUESTIONS]
}

/**
 * Returns refinement questions for the given goals, deduplicated.
 * Goals with no refinement (muscle-up, l-sit) simply have no entries.
 */
export function getGoalRefinementQuestions(goals: ProGoalId[]): RefinementQuestion[] {
  const goalSet = new Set(goals)
  const seen    = new Set<string>()
  const result: RefinementQuestion[] = []

  for (const q of REFINEMENT_QUESTIONS) {
    if (q.goals.some(g => goalSet.has(g)) && !seen.has(q.id)) {
      seen.add(q.id)
      result.push(q)
    }
  }

  return result
}

/** Total step count for the v2 form: goals + schedule + strength + skills + refinement (if any). */
export function getV2StepCount(goals: ProGoalId[]): number {
  return 4 + (getGoalRefinementQuestions(goals).length > 0 ? 1 : 0)
}

// ─── Category constraint helpers ──────────────────────────────────────────────
//
// Selection rule:
//   - Exactly 1 primary goal (any category)
//   - Up to 1 secondary goal per remaining category
//   - No secondary from the same category as the primary

/** Maps every ProGoalId to its category. */
export const GOAL_CATEGORY_MAP = new Map<ProGoalId, GoalCategory>(
  PRO_GOALS.map(g => [g.id as ProGoalId, g.category as GoalCategory])
)

/** Returns the category for a goal id. */
export function getGoalCategory(goalId: ProGoalId): GoalCategory {
  return GOAL_CATEGORY_MAP.get(goalId)!
}

/** Human-readable labels for each category. */
export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  pull: 'Pull',
  push: 'Push',
  legs: 'Legs',
  core: 'Core',
}

/**
 * Returns the three remaining categories (excluding the primary's category),
 * each with their available goals, ordered: pull → push → legs → core.
 */
export function getSecondaryGoalsByCategory(primaryGoalId: ProGoalId): {
  category: GoalCategory
  label:    string
  goals:    ProGoal[]
}[] {
  const primaryCategory = getGoalCategory(primaryGoalId)
  const ORDER: GoalCategory[] = ['pull', 'push', 'legs', 'core']
  return ORDER
    .filter(cat => cat !== primaryCategory)
    .map(cat => ({
      category: cat,
      label:    CATEGORY_LABELS[cat],
      goals:    PRO_GOALS.filter(g => g.category === cat),
    }))
}

/**
 * Removes any secondaryGoals that violate the constraint:
 *   - same category as primary goal
 *   - more than one goal per remaining category (keeps the first seen)
 *
 * Call this whenever primaryGoal changes to clean up stale selections.
 */
export function sanitizeSecondaryGoals(
  primaryGoalId: ProGoalId,
  secondaryGoals: ProGoalId[],
): ProGoalId[] {
  const primaryCategory = getGoalCategory(primaryGoalId)
  const seen = new Set<GoalCategory>()
  const result: ProGoalId[] = []
  for (const id of secondaryGoals) {
    const cat = GOAL_CATEGORY_MAP.get(id)
    if (!cat || cat === primaryCategory) continue   // same category as primary → drop
    if (seen.has(cat)) continue                      // already have one from this category → drop
    seen.add(cat)
    result.push(id)
  }
  return result
}

/**
 * Toggles a secondary goal, respecting the one-per-category constraint.
 *   - Clicking a goal from a new category → adds it
 *   - Clicking a goal from an already-selected category → swaps it
 *   - Clicking the currently selected goal in a category → deselects it
 *   - Clicking a goal in the primary's category → no-op
 */
export function toggleSecondaryGoal(
  primaryGoalId:  ProGoalId,
  current:        ProGoalId[],
  toggled:        ProGoalId,
): ProGoalId[] {
  const primaryCategory = getGoalCategory(primaryGoalId)
  const toggledCategory = getGoalCategory(toggled)
  if (toggledCategory === primaryCategory) return current   // blocked
  if (current.includes(toggled)) {
    return current.filter(id => id !== toggled)             // deselect
  }
  // Replace any existing goal in the same category, then add the new one
  return [...current.filter(id => GOAL_CATEGORY_MAP.get(id) !== toggledCategory), toggled]
}
