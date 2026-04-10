// lib/proOnboarding.ts
// Pro onboarding question system — data layer only, no UI.
//
// Design:
//   - Every pro user answers the base questions (goals, schedule, equipment, base strength).
//   - Goal-specific questions are added on top based on what the user selected.
//   - Questions are plain data objects — the UI layer can render them however it likes.
//   - Deduplication is built in: questions shared across goals (e.g. active hang)
//     appear once even when multiple goals need them.

import type { ProGoalId, ProOnboardingData, SessionLength, TrainingEmphasis } from '@/types'

// ─── sessionStorage key (shared between form and review page) ─────────────────

export const PRO_ONBOARDING_KEY = 'caliplan_pro_onboarding'

// ─── Goal definitions ─────────────────────────────────────────────────────────

export interface ProGoal {
  id:             ProGoalId
  label:          string
  description:    string
  category:       'pull' | 'push' | 'legs' | 'core'
  /** Terminal skill tree node — links this goal to the progression graph */
  terminalNodeId: string
}

export const PRO_GOALS: ProGoal[] = [
  {
    id:             'muscle-up',
    label:          'Muscle-up',
    description:    'Pull yourself above the bar in one fluid movement',
    category:       'pull',
    terminalNodeId: 'strict-mu',
  },
  {
    id:             'front-lever',
    label:          'Front lever',
    description:    'Hold your body horizontal facing up from a bar',
    category:       'pull',
    terminalNodeId: 'full-fl',
  },
  {
    id:             'back-lever',
    label:          'Back lever',
    description:    'Hold your body horizontal facing down from a bar',
    category:       'pull',
    terminalNodeId: 'full-bl',
  },
  {
    id:             'handstand',
    label:          'Freestanding handstand',
    description:    'Balance upside down without a wall',
    category:       'push',
    terminalNodeId: 'freestanding-hs',
  },
  {
    id:             'handstand-pushup',
    label:          'Handstand push-up',
    description:    'Press to full lockout in a handstand',
    category:       'push',
    terminalNodeId: 'hspu',
  },
  {
    id:             'l-sit',
    label:          'L-sit 30 seconds',
    description:    'Hold an L-sit for a full 30-second set',
    category:       'core',
    terminalNodeId: 'l-sit-30sec',
  },
  {
    id:             'pistol-squat',
    label:          'Pistol squat',
    description:    'Single-leg squat to full depth',
    category:       'legs',
    terminalNodeId: 'standard-pistol',
  },
  {
    id:             'planche',
    label:          'Planche',
    description:    'Hold your body horizontal with straight arms, parallel to the floor',
    category:       'push',
    terminalNodeId: 'full-planche',
  },
  {
    id:             'shrimp-squat',
    label:          'Shrimp squat',
    description:    'Single-leg squat holding your foot behind you — no balance support',
    category:       'legs',
    terminalNodeId: 'shrimp-squat',
  },
  {
    id:             'ring-muscle-up',
    label:          'Ring muscle-up',
    description:    'Pull yourself above the rings in one fluid movement using a false grip',
    category:       'pull',
    terminalNodeId: 'ring-mu',
  },
]

export const PRO_GOAL_MAP = new Map(PRO_GOALS.map(g => [g.id, g]))

// ─── Question definition ──────────────────────────────────────────────────────

export interface ProQuestion {
  /** Maps directly to a field in ProOnboardingData */
  id:        keyof ProOnboardingData
  label:     string
  inputType: 'number' | 'select' | 'multiselect'
  unit?:     string
  min?:      number
  max?:      number
  choices?:  { value: string; label: string }[]
  /**
   * Goals this question is relevant to.
   * Undefined on base questions (shown to everyone).
   * On goal-specific questions, used as metadata for contextual help or smart labels.
   */
  goals?:    ProGoalId[]
  helpText?: string
}

// ─── Base questions (every pro user) ─────────────────────────────────────────

const EQUIPMENT_CHOICES = [
  { value: 'Pull-up bar',              label: 'Pull-up bar' },
  { value: 'Parallel bars / dip bars', label: 'Parallel bars / dip bars' },
  { value: 'Rings',                    label: 'Rings' },
  { value: 'Parallettes',              label: 'Parallettes' },
  { value: 'Resistance bands',         label: 'Resistance bands' },
  { value: 'Nordic curl anchor',       label: 'Nordic curl anchor' },
  { value: 'Weights (belt or vest)',   label: 'Weights (belt or vest)' },
]

const BASE_QUESTIONS: ProQuestion[] = [
  {
    id:        'primaryGoal',
    label:     'What is your primary goal?',
    inputType: 'select',
    choices:   PRO_GOALS.map(g => ({ value: g.id, label: g.label })),
  },
  {
    id:        'secondaryGoals',
    label:     'Any other goals you want to work toward? (optional)',
    inputType: 'multiselect',
    choices:   PRO_GOALS.map(g => ({ value: g.id, label: g.label })),
  },
  {
    id:        'equipment',
    label:     'What equipment do you have access to?',
    inputType: 'multiselect',
    choices:   EQUIPMENT_CHOICES,
  },
  {
    id:        'trainingDays',
    label:     'How many days per week can you train?',
    inputType: 'number',
    min:       1,
    max:       6,
  },
  {
    id:        'sessionLength',
    label:     'How long is a typical session?',
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
    inputType: 'select',
    choices: [
      { value: 'strength', label: 'Strength — lower reps, heavier progressions' },
      { value: 'muscle',   label: 'Muscle — higher volume, hypertrophy focus' },
      { value: 'balanced', label: 'Balanced — strength and muscle combined' },
    ] satisfies { value: TrainingEmphasis; label: string }[],
  },
  {
    id:        'pullUpsMax',
    label:     'How many pull-ups can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Enter 0 if you cannot do a full pull-up yet',
  },
  {
    id:        'pushUpsMax',
    label:     'How many push-ups can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
  },
  {
    id:        'dipsMax',
    label:     'How many dips can you do in one set?',
    inputType: 'number',
    unit:      'reps',
    min:       0,
    helpText:  'Enter 0 if you cannot do a full dip yet',
  },
]

// ─── Goal-specific questions ──────────────────────────────────────────────────
// Questions shared by multiple goals (e.g. active hang) are defined once and
// referenced in each goal group. getGoalSpecificQuestions() deduplicates by id.

const Q_ACTIVE_HANG: ProQuestion = {
  id:        'activeHangSeconds',
  label:     'How long can you hold an active / scapular hang?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['muscle-up', 'front-lever', 'back-lever'],
  helpText:  'Shoulders pulled down and back — not shrugged up',
}

const Q_DEAD_HANG: ProQuestion = {
  id:        'deadHangSeconds',
  label:     'How long can you dead hang?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['muscle-up', 'front-lever', 'back-lever'],
  helpText:  'Passive hang, arms fully straight, shoulders relaxed',
}

const Q_WALL_HS: ProQuestion = {
  id:        'wallHandstandSeconds',
  label:     'How long can you hold a chest-to-wall handstand?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['handstand', 'handstand-pushup'],
  helpText:  'Belly facing the wall, body in a straight line — enter 0 if not yet possible',
}

const Q_FREESTANDING_HS: ProQuestion = {
  id:        'freestandingHandstandSeconds',
  label:     'How long can you hold a freestanding handstand?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['handstand', 'handstand-pushup'],
  helpText:  'Away from the wall, balanced on your own — enter 0 if not yet possible',
}

const Q_FALSE_GRIP_HANG: ProQuestion = {
  id:        'falseGripHangSeconds',
  label:     'How long can you hold a false grip hang?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['ring-muscle-up'],
  helpText:  'Wrist folded over the ring, arms straight — enter 0 if not yet possible',
}

const Q_RING_SUPPORT: ProQuestion = {
  id:        'ringSupportHoldSeconds',
  label:     'How long can you hold a ring support?',
  inputType: 'number',
  unit:      'seconds',
  min:       0,
  goals:     ['ring-muscle-up'],
  helpText:  'Arms straight, rings turned out — enter 0 if not yet possible',
}

const GOAL_QUESTIONS: Record<ProGoalId, ProQuestion[]> = {
  'muscle-up': [
    Q_ACTIVE_HANG,
    Q_DEAD_HANG,
  ],

  'front-lever': [
    Q_ACTIVE_HANG,
    Q_DEAD_HANG,
    {
      id:        'tuckFrontLeverSeconds',
      label:     'How long can you hold a tuck front lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['front-lever'],
      helpText:  'Knees tucked to chest, hips at bar height, back parallel to ground — enter 0 if not yet possible',
    },
    {
      id:        'oneLegFLSeconds',
      label:     'How long can you hold a one-leg front lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['front-lever'],
      helpText:  'One leg extended, one leg tucked — enter 0 if not yet possible',
    },
    {
      id:        'straddleFLSeconds',
      label:     'How long can you hold a straddle front lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['front-lever'],
      helpText:  'Both legs extended and spread wide — enter 0 if not yet possible',
    },
  ],

  'back-lever': [
    Q_ACTIVE_HANG,
    Q_DEAD_HANG,
    {
      id:        'skinTheCat',
      label:     'How many skin-the-cat reps can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['back-lever'],
      helpText:  'Full rotation through to German hang and back — enter 0 if not yet possible',
    },
    {
      id:        'tuckBackLeverSeconds',
      label:     'How long can you hold a tuck back lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['back-lever'],
      helpText:  'Knees tucked close to chest, hips at shoulder height, facing down — enter 0 if not yet possible',
    },
    {
      id:        'advTuckBLSeconds',
      label:     'How long can you hold an advanced tuck back lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['back-lever'],
      helpText:  'Hips extended back so thighs are parallel to the floor — harder than the tucked position — enter 0 if not yet possible',
    },
    {
      id:        'oneLegBLSeconds',
      label:     'How long can you hold a one-leg back lever?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['back-lever'],
      helpText:  'One leg extended, one leg tucked, body horizontal facing down — enter 0 if not yet possible',
    },
  ],

  'handstand': [
    Q_WALL_HS,
    Q_FREESTANDING_HS,
  ],

  'handstand-pushup': [
    Q_WALL_HS,
    Q_FREESTANDING_HS,
    {
      id:        'pikePushUpsMax',
      label:     'How many pike push-ups can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['handstand-pushup'],
      helpText:  'Hips high, head through arms, full range of motion',
    },
  ],

  'l-sit': [
    {
      id:        'lSitSeconds',
      label:     'How long can you hold an L-sit?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['l-sit'],
      helpText:  'Both legs straight and parallel to the floor — enter 0 if not yet possible',
    },
  ],

  'pistol-squat': [
    {
      id:        'pistolSquatAssisted',
      label:     'How many hand-assisted pistol squats can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['pistol-squat'],
      helpText:  'Holding a support for balance — full depth counts',
    },
    {
      id:        'pistolSquatFull',
      label:     'How many unassisted pistol squats can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['pistol-squat'],
      helpText:  'No balance support, full depth, controlled descent',
    },
  ],

  'planche': [
    {
      id:        'plancheLeanSeconds',
      label:     'How long can you hold a planche lean?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['planche'],
      helpText:  'Arms straight, body at a slight forward lean with shoulders over hands — enter 0 if not yet possible',
    },
    {
      id:        'frogStandSeconds',
      label:     'How long can you hold a frog stand?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['planche'],
      helpText:  'Knees resting on elbows, balancing on hands with feet off the floor — enter 0 if not yet possible',
    },
    {
      id:        'tuckPlancheSeconds',
      label:     'How long can you hold a tuck planche?',
      inputType: 'number',
      unit:      'seconds',
      min:       0,
      goals:     ['planche'],
      helpText:  'Hips off hands, knees tucked to chest, body parallel to the floor — enter 0 if not yet possible',
    },
  ],

  'ring-muscle-up': [
    Q_FALSE_GRIP_HANG,
    {
      id:        'falseGripPullUpsMax',
      label:     'How many false grip pull-ups can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['ring-muscle-up'],
      helpText:  'Wrist over the ring, full range of motion — enter 0 if not yet possible',
    },
    Q_RING_SUPPORT,
    {
      id:        'ringDipsMax',
      label:     'How many ring dips can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['ring-muscle-up'],
      helpText:  'Full range of motion, rings turned out at the top — enter 0 if not yet possible',
    },
  ],

  'shrimp-squat': [
    {
      id:        'shrimpSquatAssisted',
      label:     'How many assisted shrimp squats can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['shrimp-squat'],
      helpText:  'Holding a support for balance, foot held behind you — full depth counts — enter 0 if not yet possible',
    },
    {
      id:        'shrimpSquatFull',
      label:     'How many unassisted shrimp squats can you do?',
      inputType: 'number',
      unit:      'reps',
      min:       0,
      goals:     ['shrimp-squat'],
      helpText:  'No balance support, foot held behind you, full depth and controlled descent',
    },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the base questions shown to every pro user. */
export function getBaseProQuestions(): ProQuestion[] {
  return BASE_QUESTIONS
}

/**
 * Returns goal-specific questions for the given goals, deduplicated by question id.
 * Questions shared across goals (e.g. active hang appears for muscle-up, front lever,
 * and back lever) are included once — the first goal that introduces the question wins.
 */
export function getGoalSpecificQuestions(goals: ProGoalId[]): ProQuestion[] {
  const seen   = new Set<string>()
  const result: ProQuestion[] = []
  for (const goalId of goals) {
    for (const q of GOAL_QUESTIONS[goalId]) {
      if (!seen.has(q.id)) {
        seen.add(q.id)
        result.push(q)
      }
    }
  }
  return result
}

/**
 * Returns the full ordered question set for a pro user:
 * base questions first, then goal-specific questions deduplicated across goals.
 */
export function getFullProQuestionSet(goals: ProGoalId[]): ProQuestion[] {
  return [...getBaseProQuestions(), ...getGoalSpecificQuestions(goals)]
}

// ─── Node ID ↔ Goal ID helpers ────────────────────────────────────────────────

/** Maps a canonical goal id (e.g. "muscle-up") to its terminal skill tree node id (e.g. "strict-mu"). */
export function goalIdToTerminalNodeId(goalId: ProGoalId): string | undefined {
  return PRO_GOAL_MAP.get(goalId)?.terminalNodeId
}

const TERMINAL_TO_GOAL_MAP = new Map(PRO_GOALS.map(g => [g.terminalNodeId, g.id]))

/**
 * Maps a terminal skill tree node id (e.g. "strict-mu") to its canonical goal id (e.g. "muscle-up").
 * Returns undefined for node ids that have no ProGoalId mapping (e.g. "one-arm-pullup").
 */
export function terminalNodeIdToGoalId(nodeId: string): ProGoalId | undefined {
  return TERMINAL_TO_GOAL_MAP.get(nodeId)
}
