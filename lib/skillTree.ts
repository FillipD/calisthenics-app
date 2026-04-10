export type SkillCategory = 'pull' | 'push' | 'legs' | 'core'
export type EquipmentTag = 'bar' | 'rings' | 'parallettes' | 'bands' | 'weights' | 'anchor' | 'pole' | 'bars'

export interface TreeNode {
  // ── Existing fields (UI-critical — do not remove or rename) ──────────────
  id: string
  name: string
  category: SkillCategory
  parentId: string | null        // UI layout only — do not use for progression logic
  mergeParentId?: string         // UI only: secondary parent for merged edges
  isAlternative?: boolean
  isSkillGoal?: boolean
  equipment?: EquipmentTag[]
  notes?: string

  // ── Extended metadata (all optional — safe to omit on any node) ──────────
  /** Broad role of this node in the progression system */
  type?: "foundation" | "progression" | "skill" | "benchmark" | "accessory"
  /** Movement pattern group, e.g. "vertical-pull", "horizontal-push", "squat", "core-anterior" */
  movementPattern?: string
  /** Named progression branch for filtering and grouping — does not affect chain walking */
  branch?: string
  /** Primary training modality */
  trainingStyle?: "reps" | "holds" | "eccentrics" | "explosive"
  /** Relative difficulty 1 (easiest) – 10 (hardest) within the full tree */
  difficulty?: number
  /**
   * Explicit prerequisite node IDs for progression logic.
   * When present, overrides parentId for unlock/prerequisite checks.
   * Supports multi-path prerequisites (e.g. a node that requires both a push AND a pull skill).
   */
  prerequisites?: string[]
  /**
   * Explicit IDs of nodes this node unlocks.
   * When present, overrides the default children-via-parentId lookup.
   */
  unlocks?: string[]
  /** Peer-level alternative exercises for this node (same difficulty, different variation) */
  alternatives?: string[]
  /** Minimum performance standard to consider this node "passed" */
  assessment?: {
    metric: "reps" | "seconds" | "boolean"
    target: number
  }
  /** Default training prescription when programming this node */
  prescription?: {
    sets?: string
    reps?: string
    hold?: string
    frequency?: string
  }
}

export const NODES: TreeNode[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PULL
  // Branches:
  //   hang-foundations → row (horizontal pulling) → front-lever / back-lever
  //   hang-foundations → pull-up → muscle-up / unilateral
  //   hang-foundations → chin-up
  //   ring-row → ring-pulling → ring-muscle-up
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Hang foundations ──────────────────────────────────────────────────────
  // Entry point for all bar-based pulling. Everything bar-related flows through here.
  { id: 'dead-hang', name: 'Dead hang', category: 'pull', parentId: null,
    branch: 'hang-foundations', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'holds', difficulty: 1,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: '3x/week' },
  },
  { id: 'active-hang', name: 'Active / scapular hang', category: 'pull', parentId: 'dead-hang',
    branch: 'hang-foundations', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'holds', difficulty: 2,
    assessment: { metric: 'seconds', target: 20 },
    prescription: { sets: '3', hold: '10–20s', frequency: '3x/week' },
  },
  { id: 'arch-hang', name: 'Arch hang', category: 'pull', parentId: 'active-hang',
    isSkillGoal: true, branch: 'back-lever', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'holds', difficulty: 2,
    notes: 'Passive hang with slight hollow — builds shoulder flexibility and lat engagement',
    assessment: { metric: 'seconds', target: 20 },
    prescription: { sets: '3', hold: '10–20s', frequency: '3x/week' },
  },

  // ── Horizontal rows ───────────────────────────────────────────────────────
  // Core scapular retraction work — prerequisite for front lever and weighted pulling.
  { id: 'row-bent-legs', name: 'Inverted row — bent legs', category: 'pull', parentId: 'active-hang',
    branch: 'horizontal-row', type: 'foundation', movementPattern: 'horizontal-pull',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'row-straight-legs', name: 'Inverted row — straight legs', category: 'pull', parentId: 'row-bent-legs',
    branch: 'horizontal-row', type: 'progression', movementPattern: 'horizontal-pull',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'row-elevated-legs', name: 'Inverted row — elevated legs', category: 'pull', parentId: 'row-straight-legs',
    branch: 'horizontal-row', type: 'progression', movementPattern: 'horizontal-pull',
    trainingStyle: 'reps', difficulty: 4,
    alternatives: ['ring-row'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '6–10', frequency: '2x/week' },
  },
  { id: 'ring-row', name: 'Ring row', category: 'pull', parentId: 'row-elevated-legs',
    branch: 'horizontal-row', type: 'progression', movementPattern: 'horizontal-pull',
    trainingStyle: 'reps', difficulty: 4, equipment: ['rings'],
    alternatives: ['row-elevated-legs'],
    notes: 'Also entry point for ring pulling chain',
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'weighted-row', name: 'Weighted inverted row', category: 'pull', parentId: 'row-elevated-legs',
    isAlternative: true, branch: 'horizontal-row', type: 'progression',
    movementPattern: 'horizontal-pull', trainingStyle: 'reps', difficulty: 5, equipment: ['weights'],
    prescription: { sets: '4', reps: '5–8', frequency: '2x/week' },
  },

  // ── Vertical pull — pull-up chain ─────────────────────────────────────────
  { id: 'pullup-negative', name: 'Pull-up negative', category: 'pull', parentId: 'active-hang',
    branch: 'vertical-pull', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'eccentrics', difficulty: 2,
    alternatives: ['chinup-negative'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'banded-pullup', name: 'Banded pull-up', category: 'pull', parentId: 'pullup-negative',
    branch: 'vertical-pull', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'reps', difficulty: 2, equipment: ['bands'],
    alternatives: ['banded-chinup'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'pullup', name: 'Pull-up', category: 'pull', parentId: 'banded-pullup',
    branch: 'vertical-pull', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'reps', difficulty: 3, equipment: ['bar'],
    alternatives: ['chinup', 'neutral-grip'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '4', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'neutral-grip', name: 'Neutral grip pull-up', category: 'pull', parentId: 'pullup',
    isAlternative: true, branch: 'vertical-pull', type: 'accessory',
    movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 3, equipment: ['bar'],
    alternatives: ['pullup', 'chinup'],
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'l-sit-pullup', name: 'L-sit pull-up', category: 'pull', parentId: 'pullup',
    isAlternative: true, branch: 'vertical-pull', type: 'accessory',
    movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 5, equipment: ['bar'],
    alternatives: ['l-sit-chinup'],
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'weighted-pullup', name: 'Weighted pull-up', category: 'pull', parentId: 'pullup',
    isAlternative: true, branch: 'vertical-pull', type: 'benchmark',
    movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 6, equipment: ['weights'],
    alternatives: ['weighted-chinup'],
    prescription: { sets: '4', reps: '3–5', frequency: '2x/week' },
  },

  // ── Chin-up chain (parallel to pull-up) ───────────────────────────────────
  { id: 'chinup-negative', name: 'Chin-up negative', category: 'pull', parentId: 'active-hang',
    branch: 'chin-up', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'eccentrics', difficulty: 2,
    alternatives: ['pullup-negative'],
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'banded-chinup', name: 'Banded chin-up', category: 'pull', parentId: 'chinup-negative',
    branch: 'chin-up', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'reps', difficulty: 2, equipment: ['bands'],
    alternatives: ['banded-pullup'],
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'chinup', name: 'Chin-up', category: 'pull', parentId: 'banded-chinup',
    branch: 'chin-up', type: 'foundation', movementPattern: 'vertical-pull',
    trainingStyle: 'reps', difficulty: 3,
    alternatives: ['pullup', 'neutral-grip'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '4', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'l-sit-chinup', name: 'L-sit chin-up', category: 'pull', parentId: 'chinup',
    isAlternative: true, branch: 'chin-up', type: 'accessory',
    movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 5,
    alternatives: ['l-sit-pullup'],
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'explosive-chinup', name: 'Explosive chin-up', category: 'pull', parentId: 'chinup',
    isAlternative: true, branch: 'chin-up', type: 'accessory',
    movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 5,
    alternatives: ['explosive-pullup'],
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'weighted-chinup', name: 'Weighted chin-up', category: 'pull', parentId: 'chinup',
    isAlternative: true, branch: 'chin-up', type: 'benchmark',
    movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 6, equipment: ['weights'],
    alternatives: ['weighted-pullup'],
    prescription: { sets: '4', reps: '3–5', frequency: '2x/week' },
  },

  // ── Explosive / muscle-up chain ───────────────────────────────────────────
  // isSkillGoal marks each step in the directed chain to the goal.
  { id: 'explosive-pullup', name: 'Explosive pull-up', category: 'pull', parentId: 'pullup',
    isSkillGoal: true, branch: 'muscle-up',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 5,
    equipment: ['bar'],
    alternatives: ['explosive-chinup'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '4', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'high-pullup', name: 'High pull-up', category: 'pull', parentId: 'explosive-pullup',
    isSkillGoal: true, branch: 'muscle-up',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 6,
    equipment: ['bar'],
    notes: 'Chest-to-bar pull — full scapular depression at top',
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '4', reps: '2–4', frequency: '2x/week' },
  },
  { id: 'negative-mu', name: 'Negative muscle-up', category: 'pull', parentId: 'high-pullup',
    isSkillGoal: true, branch: 'muscle-up',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'eccentrics', difficulty: 7,
    equipment: ['bar'],
    prerequisites: ['high-pullup', 'dip'],
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'kipping-mu', name: 'Kipping muscle-up', category: 'pull', parentId: 'negative-mu',
    isSkillGoal: true, branch: 'muscle-up',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 8,
    equipment: ['bar'],
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '2x/week' },
  },
  { id: 'strict-mu', name: 'Strict muscle-up', category: 'pull', parentId: 'kipping-mu',
    isSkillGoal: true, branch: 'muscle-up',
    type: 'skill', movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 9,
    equipment: ['bar'],
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '2x/week' },
  },

  // ── Unilateral pull — one-arm chain ───────────────────────────────────────
  { id: 'archer-pullup', name: 'Archer pull-up', category: 'pull', parentId: 'pullup',
    isSkillGoal: true, branch: 'one-arm-pullup',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 6,
    equipment: ['bar'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'typewriter-pullup', name: 'Typewriter pull-up', category: 'pull', parentId: 'archer-pullup',
    isSkillGoal: true, branch: 'one-arm-pullup',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 7,
    equipment: ['bar'],
    notes: 'Slide laterally at the top — builds unilateral control',
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '2–4', frequency: '2x/week' },
  },
  { id: 'one-arm-hang', name: 'One arm hang', category: 'pull', parentId: 'typewriter-pullup',
    isSkillGoal: true, branch: 'one-arm-pullup',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'holds', difficulty: 7,
    equipment: ['bar'],
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '3', hold: '5–10s', frequency: '3x/week' },
  },
  { id: 'one-arm-neg-pullup', name: 'One arm pull-up negative', category: 'pull', parentId: 'one-arm-hang',
    isSkillGoal: true, branch: 'one-arm-pullup',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'eccentrics', difficulty: 8,
    equipment: ['bar'],
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'one-arm-pullup', name: 'One arm pull-up', category: 'pull', parentId: 'one-arm-neg-pullup',
    isSkillGoal: true, branch: 'one-arm-pullup',
    type: 'skill', movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 10,
    equipment: ['bar'],
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '2x/week' },
  },

  // ── Front lever ───────────────────────────────────────────────────────────
  // Prerequisites: row strength (row-elevated-legs) + vertical pull (pullup)
  { id: 'tuck-fl', name: 'Tuck front lever', category: 'pull', parentId: 'row-elevated-legs',
    isSkillGoal: true, branch: 'front-lever',
    type: 'progression', movementPattern: 'front-lever', trainingStyle: 'holds', difficulty: 5,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'adv-tuck-fl', name: 'Advanced tuck front lever', category: 'pull', parentId: 'tuck-fl',
    isSkillGoal: true, branch: 'front-lever',
    type: 'progression', movementPattern: 'front-lever', trainingStyle: 'holds', difficulty: 6,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'one-leg-fl', name: 'One leg front lever', category: 'pull', parentId: 'adv-tuck-fl',
    isSkillGoal: true, branch: 'front-lever',
    type: 'progression', movementPattern: 'front-lever', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–8s', frequency: '2x/week' },
  },
  // straddle-fl bridges the difficulty-7→9 gap that was one-leg-fl → full-fl.
  // Legs spread wide reduces the lever arm — harder than one-leg but easier than full.
  { id: 'straddle-fl', name: 'Straddle front lever', category: 'pull', parentId: 'one-leg-fl',
    isSkillGoal: true, branch: 'front-lever',
    type: 'progression', movementPattern: 'front-lever', trainingStyle: 'holds', difficulty: 8,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–5s', frequency: '2x/week' },
  },
  { id: 'full-fl', name: 'Full front lever', category: 'pull', parentId: 'straddle-fl',
    isSkillGoal: true, branch: 'front-lever',
    type: 'skill', movementPattern: 'front-lever', trainingStyle: 'holds', difficulty: 9,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–5s', frequency: '2x/week' },
  },

  // ── Back lever ────────────────────────────────────────────────────────────
  // Starts from active-hang (hanging strength + shoulder flexibility), NOT from rows.
  // Rows build retraction needed for front lever; back lever needs German hang mobility.
  { id: 'skin-the-cat', name: 'Skin the cat', category: 'pull', parentId: 'arch-hang',
    isSkillGoal: true, branch: 'back-lever',
    type: 'foundation', movementPattern: 'back-lever', trainingStyle: 'reps', difficulty: 4,
    notes: 'Full rotation through German hang and back — builds shoulder flexion and back lever entry',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'german-hang', name: 'German hang', category: 'pull', parentId: 'skin-the-cat',
    isSkillGoal: true, branch: 'back-lever',
    type: 'progression', movementPattern: 'back-lever', trainingStyle: 'holds', difficulty: 5,
    notes: 'Passive hang behind the body — shoulders in full flexion. Entry point for back lever holds.',
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '3', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'tuck-bl', name: 'Tuck back lever', category: 'pull', parentId: 'german-hang',
    isSkillGoal: true, branch: 'back-lever',
    type: 'progression', movementPattern: 'back-lever', trainingStyle: 'holds', difficulty: 5,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'adv-tuck-bl', name: 'Advanced tuck back lever', category: 'pull', parentId: 'tuck-bl',
    isSkillGoal: true, branch: 'back-lever',
    type: 'progression', movementPattern: 'back-lever', trainingStyle: 'holds', difficulty: 6,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'one-leg-bl', name: 'One leg back lever', category: 'pull', parentId: 'adv-tuck-bl',
    isSkillGoal: true, branch: 'back-lever',
    type: 'progression', movementPattern: 'back-lever', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–8s', frequency: '2x/week' },
  },
  { id: 'full-bl', name: 'Full back lever', category: 'pull', parentId: 'one-leg-bl',
    isSkillGoal: true, branch: 'back-lever',
    type: 'skill', movementPattern: 'back-lever', trainingStyle: 'holds', difficulty: 8,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–5s', frequency: '2x/week' },
  },

  // ── Ring pulling / false grip chain ───────────────────────────────────────
  // Branches from ring-row — shares ring row as both a horizontal row variation
  // and the entry to false grip / ring muscle-up work.
  { id: 'ring-pullup', name: 'Ring pull-up', category: 'pull', parentId: 'ring-row',
    branch: 'ring-pulling', type: 'progression', movementPattern: 'vertical-pull',
    trainingStyle: 'reps', difficulty: 5, equipment: ['rings'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'false-grip-hang', name: 'False grip hang', category: 'pull', parentId: 'ring-pullup',
    isSkillGoal: true, branch: 'ring-pulling', type: 'progression', movementPattern: 'vertical-pull',
    trainingStyle: 'holds', difficulty: 5, equipment: ['rings'],
    notes: 'Wrist over the ring — uncomfortable at first, essential for ring muscle-up',
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '3', hold: '5–10s', frequency: '3x/week' },
  },
  { id: 'false-grip-pullup', name: 'False grip pull-up', category: 'pull', parentId: 'false-grip-hang',
    isSkillGoal: true, branch: 'ring-pulling',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'reps', difficulty: 6,
    equipment: ['rings'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '4', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'ring-negative-mu', name: 'Ring negative muscle-up', category: 'pull', parentId: 'false-grip-pullup',
    isSkillGoal: true, branch: 'ring-pulling',
    type: 'progression', movementPattern: 'vertical-pull', trainingStyle: 'eccentrics', difficulty: 7,
    equipment: ['rings'],
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'ring-mu', name: 'Ring muscle-up', category: 'pull', parentId: 'ring-negative-mu',
    isSkillGoal: true, branch: 'ring-pulling',
    type: 'skill', movementPattern: 'vertical-pull', trainingStyle: 'explosive', difficulty: 9,
    equipment: ['rings'],
    notes: 'Requires false grip pull strength AND ring dip strength (see push tab)',
    prerequisites: ['ring-negative-mu', 'ring-dip'],
    mergeParentId: 'ring-dip',
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '2x/week' },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PUSH
  // Branches:
  //   horizontal push → planche prep
  //   horizontal push → one-arm push-up
  //   dips → ring dip → (ring muscle-up)
  //   pike press chain → HSPU
  //   handstand chain
  //   ring support holds
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Horizontal push ───────────────────────────────────────────────────────
  { id: 'incline-knee-pu', name: 'Incline knee push-up', category: 'push', parentId: null,
    branch: 'horizontal-push', type: 'foundation', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 1,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'knee-pu', name: 'Knee push-up', category: 'push', parentId: 'incline-knee-pu',
    branch: 'horizontal-push', type: 'foundation', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 2,
    alternatives: ['incline-pu'],
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'incline-pu', name: 'Incline push-up', category: 'push', parentId: 'knee-pu',
    branch: 'horizontal-push', type: 'foundation', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 2,
    alternatives: ['knee-pu'],
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'standard-pu', name: 'Standard push-up', category: 'push', parentId: 'incline-pu',
    branch: 'horizontal-push', type: 'foundation', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 20 },
    prescription: { sets: '4', reps: '10–20', frequency: '2x/week' },
  },
  { id: 'explosive-pu', name: 'Explosive push-up', category: 'push', parentId: 'standard-pu',
    branch: 'horizontal-push', type: 'progression', movementPattern: 'horizontal-push',
    trainingStyle: 'explosive', difficulty: 4,
    alternatives: ['diamond-pu', 'decline-pu'],
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '4', reps: '5–10', frequency: '2x/week' },
  },
  { id: 'diamond-pu', name: 'Diamond push-up', category: 'push', parentId: 'explosive-pu',
    isAlternative: true, branch: 'horizontal-push', type: 'accessory',
    movementPattern: 'horizontal-push', trainingStyle: 'reps', difficulty: 4,
    alternatives: ['explosive-pu', 'decline-pu'],
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'decline-pu', name: 'Decline push-up', category: 'push', parentId: 'explosive-pu',
    isAlternative: true, branch: 'horizontal-push', type: 'accessory',
    movementPattern: 'horizontal-push', trainingStyle: 'reps', difficulty: 4,
    alternatives: ['explosive-pu', 'diamond-pu'],
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'archer-pu', name: 'Archer push-up', category: 'push', parentId: 'explosive-pu',
    branch: 'one-arm-push', type: 'progression', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 5,
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'one-arm-neg-pu', name: 'One arm push-up negative', category: 'push', parentId: 'archer-pu',
    branch: 'one-arm-push', type: 'progression', movementPattern: 'horizontal-push',
    trainingStyle: 'eccentrics', difficulty: 7,
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'one-arm-pu', name: 'One arm push-up', category: 'push', parentId: 'one-arm-neg-pu',
    branch: 'one-arm-push', type: 'skill', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 9,
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–5', frequency: '2x/week' },
  },

  // ── Planche prep (straight-arm pushing) ───────────────────────────────────
  // Planche chain order: planche-lean → frog-stand → pseudo-planche-pu → tuck-planche → …
  // Frog stand (balance entry, difficulty 4) comes before pseudo-planche push-ups (strength, difficulty 5).
  // Old order had the difficulty inversion 4→5→4→6; this corrects it to 4→4→5→6.
  { id: 'planche-lean', name: 'Planche lean', category: 'push', parentId: 'explosive-pu',
    isSkillGoal: true, branch: 'planche',
    type: 'foundation', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 4,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '4', hold: '10–30s', frequency: '3x/week' },
  },
  { id: 'frog-stand', name: 'Frog stand', category: 'push', parentId: 'planche-lean',
    isSkillGoal: true, branch: 'planche',
    type: 'progression', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 4,
    notes: 'Balance drill — knees on elbows; builds wrist loading and balance before straight-arm pushing',
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '10–30s', frequency: '3x/week' },
  },
  { id: 'pseudo-planche-pu', name: 'Pseudo planche push-up', category: 'push', parentId: 'frog-stand',
    isSkillGoal: true, branch: 'planche',
    type: 'progression', movementPattern: 'planche', trainingStyle: 'reps', difficulty: 5,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '4', reps: '6–10', frequency: '2x/week' },
  },
  { id: 'tuck-planche', name: 'Tuck planche', category: 'push', parentId: 'pseudo-planche-pu',
    isSkillGoal: true, branch: 'planche',
    type: 'progression', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 6,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'adv-tuck-planche', name: 'Advanced tuck planche', category: 'push', parentId: 'tuck-planche',
    isSkillGoal: true, branch: 'planche',
    type: 'progression', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'straddle-planche', name: 'Straddle planche', category: 'push', parentId: 'adv-tuck-planche',
    isSkillGoal: true, branch: 'planche',
    type: 'progression', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 8,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–5s', frequency: '2x/week' },
  },
  { id: 'full-planche', name: 'Full planche', category: 'push', parentId: 'straddle-planche',
    isSkillGoal: true, branch: 'planche',
    type: 'skill', movementPattern: 'planche', trainingStyle: 'holds', difficulty: 10,
    assessment: { metric: 'seconds', target: 3 },
    prescription: { sets: '4', hold: '1–3s', frequency: '2x/week' },
  },

  // ── Dip family ────────────────────────────────────────────────────────────
  { id: 'bench-dip', name: 'Bench dip', category: 'push', parentId: null,
    branch: 'dip', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 1,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'dip-negative', name: 'Dip negative', category: 'push', parentId: 'bench-dip',
    branch: 'dip', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'eccentrics', difficulty: 2, equipment: ['bars'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'banded-dip', name: 'Banded dip', category: 'push', parentId: 'dip-negative',
    branch: 'dip', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 2, equipment: ['bars', 'bands'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '6–10', frequency: '2x/week' },
  },
  { id: 'dip', name: 'Dip', category: 'push', parentId: 'banded-dip',
    branch: 'dip', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 3, equipment: ['bars'],
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '4', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'weighted-dip', name: 'Weighted dip', category: 'push', parentId: 'dip',
    isAlternative: true, branch: 'dip', type: 'benchmark',
    movementPattern: 'vertical-push', trainingStyle: 'reps', difficulty: 6,
    equipment: ['bars', 'weights'],
    alternatives: ['ring-dip'],
    prescription: { sets: '4', reps: '3–6', frequency: '2x/week' },
  },
  // ── Ring support holds ────────────────────────────────────────────────────
  // ring-support-hold connects to the dip chain: dip → ring-support-hold → ring-dip.
  // Prerequisites on ring-dip encodes the dual requirement: bar dip strength + ring stability.
  { id: 'ring-support-hold', name: 'Ring support hold', category: 'push', parentId: 'dip',
    branch: 'ring-support', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'holds', difficulty: 3, equipment: ['rings'],
    notes: 'Arms straight, rings turned out — essential stability prerequisite before ring dips',
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '15–30s', frequency: '3x/week' },
  },
  { id: 'ring-pushup', name: 'Ring push-up', category: 'push', parentId: 'ring-support-hold',
    branch: 'ring-support', type: 'progression', movementPattern: 'horizontal-push',
    trainingStyle: 'reps', difficulty: 4, equipment: ['rings'],
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'ring-dip', name: 'Ring dip', category: 'push', parentId: 'ring-support-hold',
    branch: 'ring-support', type: 'progression', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 6, equipment: ['rings'],
    prerequisites: ['dip', 'ring-support-hold'],
    alternatives: ['weighted-dip'],
    notes: 'Requires both bar dip strength (dip) and ring stability (ring-support-hold)',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '4', reps: '3–5', frequency: '2x/week' },
  },

  // ── Pike press / vertical push → HSPU ────────────────────────────────────
  { id: 'elevated-pike-pu', name: 'Elevated pike push-up', category: 'push', parentId: null,
    branch: 'handstand-pushup', type: 'foundation', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'pike-pu', name: 'Pike push-up', category: 'push', parentId: 'elevated-pike-pu',
    branch: 'handstand-pushup', type: 'progression', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'decline-pike-pu', name: 'Decline pike push-up', category: 'push', parentId: 'pike-pu',
    branch: 'handstand-pushup', type: 'progression', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 4,
    // Same movement, different equipment — treat as peer alternatives so the
    // near-duplicate check prevents them appearing together in the same role.
    alternatives: ['decline-pike-parall'],
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'decline-pike-parall', name: 'Decline pike — parallettes', category: 'push', parentId: 'decline-pike-pu',
    branch: 'handstand-pushup', type: 'progression', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 5, equipment: ['parallettes'],
    alternatives: ['decline-pike-pu'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '6–10', frequency: '2x/week' },
  },
  { id: 'wall-assisted-hspu', name: 'Wall-assisted HSPU', category: 'push', parentId: 'decline-pike-parall',
    branch: 'handstand-pushup', type: 'progression', movementPattern: 'vertical-push',
    trainingStyle: 'reps', difficulty: 6,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '4', reps: '3–6', frequency: '2x/week' },
  },
  // HSPU requires BOTH vertical push strength AND handstand balance
  { id: 'hspu', name: 'Handstand push-up', category: 'push', parentId: 'wall-assisted-hspu',
    isSkillGoal: true, branch: 'handstand-pushup',
    mergeParentId: 'chest-to-wall-hs',
    type: 'skill', movementPattern: 'vertical-push', trainingStyle: 'reps', difficulty: 8,
    prerequisites: ['wall-assisted-hspu', 'chest-to-wall-hs'],
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '4', reps: '1–5', frequency: '2x/week' },
  },

  // ── Handstand ─────────────────────────────────────────────────────────────
  { id: 'wall-plank', name: 'Wall plank', category: 'push', parentId: null,
    isSkillGoal: true, branch: 'handstand',
    type: 'foundation', movementPattern: 'handstand', trainingStyle: 'holds', difficulty: 2,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: 'daily' },
  },
  { id: 'kick-to-wall-hs', name: 'Kick to wall handstand', category: 'push', parentId: 'wall-plank',
    isSkillGoal: true, branch: 'handstand',
    type: 'progression', movementPattern: 'handstand', trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '5–10', frequency: 'daily' },
  },
  { id: 'chest-to-wall-hs', name: 'Chest-to-wall handstand', category: 'push', parentId: 'kick-to-wall-hs',
    isSkillGoal: true, branch: 'handstand',
    type: 'progression', movementPattern: 'handstand', trainingStyle: 'holds', difficulty: 5,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: 'daily' },
  },
  { id: 'hs-kick-balance', name: 'Handstand kick-up balance', category: 'push', parentId: 'chest-to-wall-hs',
    isSkillGoal: true, branch: 'handstand',
    type: 'progression', movementPattern: 'handstand', trainingStyle: 'holds', difficulty: 6,
    notes: 'Kick up and find balance away from the wall — hold for 1–5s before stepping down',
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '5', hold: '1–5s', frequency: 'daily' },
  },
  { id: 'freestanding-hs', name: 'Freestanding handstand', category: 'push', parentId: 'hs-kick-balance',
    isSkillGoal: true, branch: 'handstand',
    type: 'skill', movementPattern: 'handstand', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '5', hold: '5–10s', frequency: 'daily' },
  },
  { id: 'press-handstand', name: 'Press to handstand', category: 'push', parentId: 'freestanding-hs',
    isSkillGoal: true, branch: 'handstand',
    type: 'skill', movementPattern: 'handstand', trainingStyle: 'reps', difficulty: 9,
    notes: 'Straddle press or pike press — requires compression + balance + shoulder strength',
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '3x/week' },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGS
  // Branches:
  //   squat-foundation → plyometrics
  //   squat-foundation → split/lunge → pistol-squat
  //   squat-foundation → split/lunge → shrimp-squat
  //   posterior-chain → nordic-curl
  //   calf-ankle
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Squat foundation ──────────────────────────────────────────────────────
  { id: 'bodyweight-squat', name: 'Bodyweight squat', category: 'legs', parentId: null,
    branch: 'squat-foundation', type: 'foundation', movementPattern: 'squat',
    trainingStyle: 'reps', difficulty: 1,
    assessment: { metric: 'reps', target: 20 },
    prescription: { sets: '3', reps: '15–20', frequency: '2x/week' },
  },
  { id: 'deep-squat', name: 'Deep squat', category: 'legs', parentId: 'bodyweight-squat',
    branch: 'squat-foundation', type: 'foundation', movementPattern: 'squat',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'pause-squat', name: 'Pause squat', category: 'legs', parentId: 'deep-squat',
    branch: 'squat-foundation', type: 'progression', movementPattern: 'squat',
    trainingStyle: 'holds', difficulty: 3,
    notes: '3–5 second pause at the bottom — builds positional strength and mobility',
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–10', frequency: '2x/week' },
  },

  // ── Plyometrics (from pause-squat — requires solid squat mechanics) ───────
  { id: 'jump-squat', name: 'Jump squat', category: 'legs', parentId: 'pause-squat',
    branch: 'plyometrics', type: 'progression', movementPattern: 'squat',
    trainingStyle: 'explosive', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–10', frequency: '2x/week' },
  },
  { id: 'box-jump', name: 'Box jump', category: 'legs', parentId: 'jump-squat',
    branch: 'plyometrics', type: 'progression', movementPattern: 'squat',
    trainingStyle: 'explosive', difficulty: 4,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '4', reps: '4–6', frequency: '2x/week' },
  },
  { id: 'broad-jump', name: 'Broad jump', category: 'legs', parentId: 'box-jump',
    branch: 'plyometrics', type: 'progression', movementPattern: 'squat',
    trainingStyle: 'explosive', difficulty: 5,
    prescription: { sets: '4', reps: '4–6', frequency: '2x/week' },
  },
  { id: 'depth-jump', name: 'Depth jump', category: 'legs', parentId: 'broad-jump',
    branch: 'plyometrics', type: 'benchmark', movementPattern: 'squat',
    trainingStyle: 'explosive', difficulty: 6,
    notes: 'Step off box, absorb landing, immediately jump — high reactive demand',
    prescription: { sets: '4', reps: '4–6', frequency: '2x/week' },
  },

  // ── Split / lunge → pistol squat ─────────────────────────────────────────
  { id: 'reverse-lunge', name: 'Reverse lunge', category: 'legs', parentId: 'deep-squat',
    branch: 'pistol-squat', type: 'foundation', movementPattern: 'squat',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 12 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', category: 'legs', parentId: 'reverse-lunge',
    branch: 'pistol-squat', type: 'progression', movementPattern: 'squat',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  // ATG split squat — deep knee-over-toe drill; builds ankle dorsiflexion and quad strength
  // for pistol squat. Parallel to the main pistol chain — not on it.
  { id: 'atg-split-squat', name: 'ATG split squat', category: 'legs', parentId: 'bulgarian-split-squat',
    isAlternative: true, branch: 'pistol-squat', type: 'accessory', movementPattern: 'squat',
    trainingStyle: 'reps', difficulty: 5,
    notes: 'Knee over toe drill — combines ankle mobility and quad strength; great pistol prep',
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'pistol-hand-assist', name: 'Pistol squat — hand assisted', category: 'legs', parentId: 'bulgarian-split-squat',
    branch: 'pistol-squat', type: 'progression', movementPattern: 'pistol-squat',
    trainingStyle: 'reps', difficulty: 4,
    alternatives: ['shrimp-squat-assisted'],
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'pistol-opp-leg-free', name: 'Pistol squat — free leg assisted', category: 'legs', parentId: 'pistol-hand-assist',
    branch: 'pistol-squat', type: 'progression', movementPattern: 'pistol-squat',
    trainingStyle: 'reps', difficulty: 5,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–6', frequency: '2x/week' },
  },
  { id: 'elevated-pistol', name: 'Elevated pistol squat', category: 'legs', parentId: 'pistol-opp-leg-free',
    branch: 'pistol-squat', type: 'progression', movementPattern: 'pistol-squat',
    trainingStyle: 'reps', difficulty: 6,
    alternatives: ['shrimp-squat-free'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–6', frequency: '2x/week' },
  },
  { id: 'standard-pistol', name: 'Standard pistol squat', category: 'legs', parentId: 'elevated-pistol',
    isSkillGoal: true, branch: 'pistol-squat',
    type: 'skill', movementPattern: 'pistol-squat', trainingStyle: 'reps', difficulty: 7,
    alternatives: ['shrimp-squat'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–6', frequency: '2x/week' },
  },
  { id: 'weighted-pistol', name: 'Weighted pistol squat', category: 'legs', parentId: 'standard-pistol',
    branch: 'pistol-squat', type: 'benchmark', movementPattern: 'pistol-squat',
    trainingStyle: 'reps', difficulty: 8, equipment: ['weights'],
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },

  // ── Shrimp squat branch (from bulgarian — parallel to pistol) ────────────
  // 3-step chain: assisted → free (partial depth) → full range.
  { id: 'shrimp-squat-assisted', name: 'Shrimp squat — assisted', category: 'legs', parentId: 'bulgarian-split-squat',
    isSkillGoal: true, branch: 'shrimp-squat',
    type: 'progression', movementPattern: 'squat', trainingStyle: 'reps', difficulty: 4,
    alternatives: ['pistol-hand-assist'],
    notes: 'Rear ankle held — more quad-dominant than pistol; great alternative for limited ankle mobility',
    assessment: { metric: 'reps', target: 8 },
    prescription: { sets: '3', reps: '5–8', frequency: '2x/week' },
  },
  { id: 'shrimp-squat-free', name: 'Shrimp squat — free', category: 'legs', parentId: 'shrimp-squat-assisted',
    isSkillGoal: true, branch: 'shrimp-squat',
    type: 'progression', movementPattern: 'squat', trainingStyle: 'reps', difficulty: 6,
    alternatives: ['elevated-pistol'],
    notes: 'No balance support — partial depth (thigh to parallel), rear foot free behind body',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'shrimp-squat', name: 'Shrimp squat', category: 'legs', parentId: 'shrimp-squat-free',
    isSkillGoal: true, branch: 'shrimp-squat',
    type: 'skill', movementPattern: 'squat', trainingStyle: 'reps', difficulty: 7,
    alternatives: ['standard-pistol'],
    notes: 'Full range — rear foot reaches glute at the bottom',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },

  // ── Posterior chain / hamstrings → nordic curl ────────────────────────────
  { id: 'hip-hinge', name: 'Bodyweight RDL', category: 'legs', parentId: null,
    branch: 'nordic-curl', type: 'foundation', movementPattern: 'hinge',
    trainingStyle: 'reps', difficulty: 1,
    notes: 'Bodyweight RDL pattern — teaches posterior tilt and hamstring loading',
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'single-leg-rdl', name: 'Single-leg RDL', category: 'legs', parentId: 'hip-hinge',
    branch: 'nordic-curl', type: 'progression', movementPattern: 'hinge',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–10', frequency: '2x/week' },
  },
  { id: 'hamstring-bridge', name: 'Lying hamstring curl', category: 'legs', parentId: 'single-leg-rdl',
    branch: 'nordic-curl', type: 'progression', movementPattern: 'hinge',
    trainingStyle: 'reps', difficulty: 3,
    notes: 'Heels on floor or low surface — bridge up then curl heels in; builds hamstring strength before loaded nordic work',
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'nordic-neg-ppt', name: 'Nordic curl negative — PPT', category: 'legs', parentId: 'hamstring-bridge',
    branch: 'nordic-curl', type: 'progression', movementPattern: 'hinge',
    trainingStyle: 'eccentrics', difficulty: 4, equipment: ['anchor'],
    notes: 'Posterior pelvic tilt brace — very slow descent focus',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'nordic-neg-ppt-pu', name: 'Nordic curl negative — PPT + push-up', category: 'legs', parentId: 'nordic-neg-ppt',
    branch: 'nordic-curl', type: 'progression', movementPattern: 'hinge',
    trainingStyle: 'eccentrics', difficulty: 5, equipment: ['anchor'],
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'nordic-neg-pu', name: 'Nordic curl negative — push-up', category: 'legs', parentId: 'nordic-neg-ppt-pu',
    branch: 'nordic-curl', type: 'progression', movementPattern: 'hinge',
    trainingStyle: 'eccentrics', difficulty: 6, equipment: ['anchor'],
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'nordic-standard', name: 'Nordic curl', category: 'legs', parentId: 'nordic-neg-pu',
    isSkillGoal: true, branch: 'nordic-curl',
    type: 'skill', movementPattern: 'hinge', trainingStyle: 'eccentrics', difficulty: 8,
    equipment: ['anchor'],
    assessment: { metric: 'reps', target: 1 },
    prescription: { sets: '3', reps: '1–3', frequency: '2x/week' },
  },

  // ── Calf and ankle ────────────────────────────────────────────────────────
  { id: 'calf-both', name: 'Calf raise — both legs', category: 'legs', parentId: null,
    branch: 'calf-ankle', type: 'foundation', movementPattern: 'calf',
    trainingStyle: 'reps', difficulty: 1,
    assessment: { metric: 'reps', target: 20 },
    prescription: { sets: '3', reps: '15–20', frequency: '3x/week' },
  },
  { id: 'calf-elevated-both', name: 'Elevated calf raise — both legs', category: 'legs', parentId: 'calf-both',
    branch: 'calf-ankle', type: 'progression', movementPattern: 'calf',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 20 },
    prescription: { sets: '3', reps: '15–20', frequency: '3x/week' },
  },
  { id: 'calf-single', name: 'Single-leg calf raise', category: 'legs', parentId: 'calf-elevated-both',
    branch: 'calf-ankle', type: 'progression', movementPattern: 'calf',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '12–15', frequency: '3x/week' },
  },
  { id: 'calf-elevated-single', name: 'Elevated single-leg calf raise', category: 'legs', parentId: 'calf-single',
    branch: 'calf-ankle', type: 'benchmark', movementPattern: 'calf',
    trainingStyle: 'reps', difficulty: 4,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '12–15', frequency: '3x/week' },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE
  // Branches:
  //   hollow-body → ab-wheel (anti-extension)
  //   hanging-core → dragon-flag
  //   l-sit compression chain
  //   lateral / rotation → human flag
  //   posterior trunk
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Hollow body / anti-extension ─────────────────────────────────────────
  { id: 'hollow-hands-side', name: 'Hollow body — hands at side', category: 'core', parentId: null,
    branch: 'hollow-body', type: 'foundation', movementPattern: 'core-anterior',
    trainingStyle: 'holds', difficulty: 1,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: '3x/week' },
  },
  { id: 'hollow-hands-overhead', name: 'Hollow body — hands overhead', category: 'core', parentId: 'hollow-hands-side',
    branch: 'hollow-body', type: 'progression', movementPattern: 'core-anterior',
    trainingStyle: 'holds', difficulty: 2,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: '3x/week' },
  },
  { id: 'hollow-arm-circles', name: 'Hollow body — arm circles', category: 'core', parentId: 'hollow-hands-overhead',
    branch: 'hollow-body', type: 'progression', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 3,
    prescription: { sets: '3', reps: '10 circles', frequency: '3x/week' },
  },
  { id: 'ab-wheel-kneeling', name: 'Ab wheel — kneeling', category: 'core', parentId: 'hollow-arm-circles',
    branch: 'hollow-body', type: 'progression', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 5,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'ab-wheel-standing', name: 'Ab wheel — standing', category: 'core', parentId: 'ab-wheel-kneeling',
    branch: 'hollow-body', type: 'skill', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 8,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },

  // ── Hanging core ──────────────────────────────────────────────────────────
  { id: 'knee-raises', name: 'Hanging knee raises', category: 'core', parentId: null,
    branch: 'hanging-core', type: 'foundation', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '10–15', frequency: '2x/week' },
  },
  { id: 'knee-raises-one-leg', name: 'Hanging knee raises — one leg extended', category: 'core', parentId: 'knee-raises',
    branch: 'hanging-core', type: 'progression', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'standard-leg-raises', name: 'Hanging leg raises', category: 'core', parentId: 'knee-raises-one-leg',
    branch: 'hanging-core', type: 'progression', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 5,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'toes-to-bar', name: 'Toes to bar', category: 'core', parentId: 'standard-leg-raises',
    branch: 'hanging-core', type: 'benchmark', movementPattern: 'core-anterior',
    trainingStyle: 'reps', difficulty: 6,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–10', frequency: '2x/week' },
  },
  { id: 'windshield-wipers', name: 'Windshield wipers', category: 'core', parentId: 'toes-to-bar',
    branch: 'hanging-core', type: 'benchmark', movementPattern: 'core-rotation',
    trainingStyle: 'reps', difficulty: 7,
    prescription: { sets: '3', reps: '8–10 total', frequency: '2x/week' },
  },

  // ── Dragon flag ───────────────────────────────────────────────────────────
  { id: 'dragon-flag-negative', name: 'Dragon flag — negative', category: 'core', parentId: 'standard-leg-raises',
    isSkillGoal: true, branch: 'dragon-flag',
    type: 'progression', movementPattern: 'core-anterior', trainingStyle: 'eccentrics', difficulty: 5,
    notes: 'Lower slowly from top position — control the descent before attempting holds or positives',
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'tuck-dragon-flag', name: 'Tuck dragon flag', category: 'core', parentId: 'dragon-flag-negative',
    isSkillGoal: true, branch: 'dragon-flag',
    type: 'progression', movementPattern: 'core-anterior', trainingStyle: 'reps', difficulty: 6,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'half-tuck-dragon-flag', name: 'Half tuck dragon flag', category: 'core', parentId: 'tuck-dragon-flag',
    isSkillGoal: true, branch: 'dragon-flag',
    type: 'progression', movementPattern: 'core-anterior', trainingStyle: 'reps', difficulty: 7,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '3–5', frequency: '2x/week' },
  },
  { id: 'straddle-dragon-flag', name: 'Straddle dragon flag', category: 'core', parentId: 'half-tuck-dragon-flag',
    isSkillGoal: true, branch: 'dragon-flag',
    type: 'progression', movementPattern: 'core-anterior', trainingStyle: 'reps', difficulty: 8,
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '2–4', frequency: '2x/week' },
  },
  { id: 'full-dragon-flag', name: 'Full dragon flag', category: 'core', parentId: 'straddle-dragon-flag',
    isSkillGoal: true, branch: 'dragon-flag',
    type: 'skill', movementPattern: 'core-anterior', trainingStyle: 'reps', difficulty: 9,
    assessment: { metric: 'reps', target: 3 },
    prescription: { sets: '3', reps: '2–5', frequency: '2x/week' },
  },

  // ── L-sit / compression chain ─────────────────────────────────────────────
  { id: 'pike-lift-lean-one-leg', name: 'Pike lift — lean back, one leg', category: 'core', parentId: null,
    branch: 'l-sit', type: 'foundation', movementPattern: 'l-sit',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'pike-lift-one-leg', name: 'Pike lift — one leg', category: 'core', parentId: 'pike-lift-lean-one-leg',
    branch: 'l-sit', type: 'progression', movementPattern: 'l-sit',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'pike-lift-both-legs', name: 'Pike lift — both legs', category: 'core', parentId: 'pike-lift-one-leg',
    branch: 'l-sit', type: 'progression', movementPattern: 'l-sit',
    trainingStyle: 'reps', difficulty: 4,
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '5–10', frequency: '2x/week' },
  },
  { id: 'l-sit-foot-supported', name: 'Foot supported L-sit', category: 'core', parentId: 'pike-lift-both-legs',
    isSkillGoal: true, branch: 'l-sit',
    type: 'progression', movementPattern: 'l-sit', trainingStyle: 'holds', difficulty: 4,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'l-sit-one-leg', name: 'One leg L-sit', category: 'core', parentId: 'l-sit-foot-supported',
    isSkillGoal: true, branch: 'l-sit',
    type: 'progression', movementPattern: 'l-sit', trainingStyle: 'holds', difficulty: 5,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'l-sit-full', name: 'Full L-sit', category: 'core', parentId: 'l-sit-one-leg',
    isSkillGoal: true, branch: 'l-sit',
    type: 'progression', movementPattern: 'l-sit', trainingStyle: 'holds', difficulty: 6,
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '4', hold: '3–5s', frequency: '2x/week' },
  },
  { id: 'l-sit-10sec', name: 'L-sit — 10 second hold', category: 'core', parentId: 'l-sit-full',
    isSkillGoal: true, branch: 'l-sit',
    type: 'benchmark', movementPattern: 'l-sit', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '4', hold: '8–12s', frequency: '2x/week' },
  },
  { id: 'l-sit-30sec', name: 'L-sit — 30 second hold', category: 'core', parentId: 'l-sit-10sec',
    isSkillGoal: true, branch: 'l-sit',
    type: 'skill', movementPattern: 'l-sit', trainingStyle: 'holds', difficulty: 7,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: '2x/week' },
  },
  { id: 'v-sit', name: 'V-sit', category: 'core', parentId: 'l-sit-30sec',
    branch: 'l-sit', type: 'skill', movementPattern: 'l-sit',
    trainingStyle: 'holds', difficulty: 9,
    notes: 'Legs above horizontal — combines L-sit compression with hamstring flexibility',
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '3', hold: '3–5s', frequency: '2x/week' },
  },

  // ── Lateral / rotation chain ──────────────────────────────────────────────
  { id: 'side-plank', name: 'Side plank', category: 'core', parentId: null,
    branch: 'lateral-core', type: 'foundation', movementPattern: 'core-lateral',
    trainingStyle: 'holds', difficulty: 2,
    assessment: { metric: 'seconds', target: 30 },
    prescription: { sets: '3', hold: '20–30s', frequency: '3x/week' },
  },
  { id: 'rotating-side-plank', name: 'Rotating side plank', category: 'core', parentId: 'side-plank',
    branch: 'lateral-core', type: 'progression', movementPattern: 'core-rotation',
    trainingStyle: 'reps', difficulty: 3,
    assessment: { metric: 'reps', target: 10 },
    prescription: { sets: '3', reps: '8–12', frequency: '2x/week' },
  },
  { id: 'copenhagen-plank', name: 'Copenhagen plank', category: 'core', parentId: 'rotating-side-plank',
    branch: 'lateral-core', type: 'benchmark', movementPattern: 'core-lateral',
    trainingStyle: 'holds', difficulty: 5,
    notes: 'Top leg elevated on bench — adductor and lateral core strength',
    assessment: { metric: 'seconds', target: 20 },
    prescription: { sets: '3', hold: '10–20s', frequency: '2x/week' },
  },

  // ── Human flag ────────────────────────────────────────────────────────────
  // human-flag-prep bridges the 4-point gap (side-plank diff 2 → tuck-human-flag diff 6).
  // It requires pull-up and dip strength — the two forces needed to hold a flag on a pole.
  { id: 'human-flag-prep', name: 'Human flag — inclined hold', category: 'core', parentId: 'side-plank',
    isSkillGoal: true, branch: 'human-flag',
    type: 'progression', movementPattern: 'core-lateral', trainingStyle: 'holds', difficulty: 4,
    equipment: ['pole'],
    prerequisites: ['pullup', 'dip'],
    notes: 'Body at ~45° diagonal from the pole — practice the push-pull mechanics before going fully horizontal',
    assessment: { metric: 'seconds', target: 10 },
    prescription: { sets: '3', hold: '5–10s', frequency: '2x/week' },
  },
  { id: 'tuck-human-flag', name: 'Tuck human flag', category: 'core', parentId: 'human-flag-prep',
    isSkillGoal: true, branch: 'human-flag',
    type: 'progression', movementPattern: 'core-lateral', trainingStyle: 'holds', difficulty: 6,
    equipment: ['pole'],
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '3', hold: '3–5s', frequency: '2x/week' },
  },
  { id: 'half-human-flag', name: 'Half human flag', category: 'core', parentId: 'tuck-human-flag',
    isSkillGoal: true, branch: 'human-flag',
    type: 'progression', movementPattern: 'core-lateral', trainingStyle: 'holds', difficulty: 7,
    equipment: ['pole'],
    assessment: { metric: 'seconds', target: 5 },
    prescription: { sets: '3', hold: '3–5s', frequency: '2x/week' },
  },
  { id: 'full-human-flag', name: 'Full human flag', category: 'core', parentId: 'half-human-flag',
    isSkillGoal: true, branch: 'human-flag',
    type: 'skill', movementPattern: 'core-lateral', trainingStyle: 'holds', difficulty: 9,
    equipment: ['pole'],
    assessment: { metric: 'seconds', target: 3 },
    prescription: { sets: '3', hold: '2–5s', frequency: '2x/week' },
  },

  // ── Posterior trunk ───────────────────────────────────────────────────────
  { id: 'reverse-hyperextension', name: 'Reverse hyperextension', category: 'core', parentId: null,
    branch: 'posterior-trunk', type: 'foundation', movementPattern: 'core-posterior',
    trainingStyle: 'reps', difficulty: 2,
    assessment: { metric: 'reps', target: 15 },
    prescription: { sets: '3', reps: '12–15', frequency: '2x/week' },
  },
  { id: 'jefferson-curl', name: 'Jefferson curl', category: 'core', parentId: 'reverse-hyperextension',
    branch: 'posterior-trunk', type: 'benchmark', movementPattern: 'core-posterior',
    trainingStyle: 'reps', difficulty: 4,
    notes: 'Loaded spinal flexion — develops posterior chain flexibility under load',
    assessment: { metric: 'reps', target: 5 },
    prescription: { sets: '3', reps: '8–10', frequency: '2x/week' },
  },
]

// ─── Pre-built lookup helpers ─────────────────────────────────────────────────

export const NODE_MAP = new Map(NODES.map(n => [n.id, n]))

export function buildChildrenMap(category?: SkillCategory): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const node of NODES) {
    if (category && node.category !== category) continue
    if (!node.parentId) continue
    if (!map.has(node.parentId)) map.set(node.parentId, [])
    map.get(node.parentId)!.push(node.id)
  }
  return map
}

export function getRoots(category: SkillCategory): TreeNode[] {
  return NODES.filter(n => n.category === category && n.parentId === null)
}

// ─── Skill goal config ────────────────────────────────────────────────────────
// Terminal nodes for the goals panel and assessment pipeline.
// ring-mu and one-arm-pullup are listed but not yet wired to ProGoalId — reserved for future goals.
export const TAB_SKILL_GOALS: Record<SkillCategory, string[]> = {
  pull: ["full-fl", "full-bl", "strict-mu", "ring-mu", "one-arm-pullup"],
  push: ["freestanding-hs", "hspu", "full-planche"],
  legs: ["standard-pistol", "nordic-standard", "shrimp-squat"],
  core: ["l-sit-30sec", "full-dragon-flag", "full-human-flag"],
}

export const TERMINAL_GOAL_SET = new Set(Object.values(TAB_SKILL_GOALS).flat())

export const CATEGORIES: { id: SkillCategory; label: string }[] = [
  { id: "pull", label: "Pull" },
  { id: "push", label: "Push" },
  { id: "legs", label: "Legs" },
  { id: "core", label: "Core" },
]

// ─── Chain walking helpers (unchanged API, same semantics) ────────────────────

/** Walk parentId chain to find the root ancestor (parentId === null) */
export function findRootAncestor(nodeId: string): string {
  let node = NODE_MAP.get(nodeId)
  while (node?.parentId) node = NODE_MAP.get(node.parentId)
  return node?.id ?? nodeId
}

/**
 * Walk UP the parentId chain from a skill goal node, following only nodes that
 * have isSkillGoal: true, to find the FIRST (most basic) step in that skill's
 * branch. The returned ID is the starting point when a user sets this goal.
 */
export function findFirstSkillStep(goalNodeId: string): string {
  let nodeId    = goalNodeId
  let firstStep = goalNodeId
  while (true) {
    const node = NODE_MAP.get(nodeId)
    if (!node?.parentId) break
    const parent = NODE_MAP.get(node.parentId)
    if (!parent?.isSkillGoal) break
    nodeId    = node.parentId
    firstStep = nodeId
  }
  return firstStep
}

/**
 * Find the next step in a skill goal chain — the isSkillGoal child of
 * currentNodeId. Returns null when the user has reached the terminal goal.
 */
export function findNextSkillStep(currentNodeId: string): string | null {
  const child = NODES.find(n => n.parentId === currentNodeId && n.isSkillGoal)
  return child?.id ?? null
}

/**
 * Returns the full ordered chain of isSkillGoal steps from first step to goal.
 */
export function getSkillChain(goalNodeId: string): string[] {
  const first = findFirstSkillStep(goalNodeId)
  const chain: string[] = [first]
  let current = first
  while (current !== goalNodeId) {
    const next = findNextSkillStep(current)
    if (!next) break
    chain.push(next)
    current = next
  }
  return chain
}

/**
 * Given a skill goal and the user's progress map, returns the best current
 * progression step. Prefers the user's `current` node, then the step after
 * their last `completed` node, then falls back to the first step.
 */
export function findBestSkillStep(
  goalNodeId: string,
  progressMap: Record<string, string>,
): string {
  const chain = getSkillChain(goalNodeId)

  for (const nodeId of chain) {
    if (progressMap[nodeId] === "current") return nodeId
  }

  for (let i = chain.length - 1; i >= 0; i--) {
    if (progressMap[chain[i]] === "completed") {
      return chain[i + 1] ?? chain[i]
    }
  }

  return findFirstSkillStep(goalNodeId)
}

// ─── Extended metadata helpers ────────────────────────────────────────────────

export function getSkillNode(id: string): TreeNode | undefined {
  return NODE_MAP.get(id)
}

export function getPrerequisiteNodes(id: string): TreeNode[] {
  const node = NODE_MAP.get(id)
  if (!node) return []
  if (node.prerequisites && node.prerequisites.length > 0) {
    return node.prerequisites
      .map(pid => NODE_MAP.get(pid))
      .filter((n): n is TreeNode => n !== undefined)
  }
  if (node.parentId) {
    const parent = NODE_MAP.get(node.parentId)
    return parent ? [parent] : []
  }
  return []
}

export function getUnlockNodes(id: string): TreeNode[] {
  const node = NODE_MAP.get(id)
  if (!node) return []
  if (node.unlocks && node.unlocks.length > 0) {
    return node.unlocks
      .map(uid => NODE_MAP.get(uid))
      .filter((n): n is TreeNode => n !== undefined)
  }
  return NODES.filter(n => n.parentId === id)
}

export function isSkillNodeUnlocked(
  id: string,
  completedNodeIds: Set<string>,
  currentNodeIds: Set<string>,
): boolean {
  const node = NODE_MAP.get(id)
  if (!node) return false
  const prereqs: string[] =
    node.prerequisites && node.prerequisites.length > 0
      ? node.prerequisites
      : node.parentId
      ? [node.parentId]
      : []
  if (prereqs.length === 0) return true
  return prereqs.every(pid => completedNodeIds.has(pid) || currentNodeIds.has(pid))
}
