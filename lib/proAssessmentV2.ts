// lib/proAssessmentV2.ts
// Two-stage pro assessment for the redesigned onboarding model.
//
// Stage 1 — assessFromBenchmarks():
//   Takes GlobalBenchmarks and fills the whole tree broadly.
//   Every user gets pull, push, legs, and core chain placement
//   regardless of which goals they selected.
//
// Stage 2 — assessGoalRefinement():
//   Takes GoalRefinementData and refines placement within selected goal branches.
//   Runs on top of stage 1 results — completed nodes from stage 1 are preserved.
//
// assessProUserV2() combines both stages and returns the same ProAssessmentResult
// shape used by the review page and save API — no changes needed downstream.
//
// Design notes:
//   - Conservative: milestone labels imply the user HAS achieved that level,
//     so the current node is the NEXT step above it.
//   - Completed beats current: resolved at the end (same as v1).
//   - Stage 2 never removes completed nodes set by stage 1.

import type {
  ProGoalId,
  GlobalBenchmarks,
  GoalRefinementData,
  ProOnboardingDataV2,
  FrontLeverLevel,
  BackLeverLevel,
  HandstandLevel,
  PlancheLevel,
  RingMULevel,
  PistolSquatLevel,
  ShrimpSquatLevel,
  LSitLevel,
} from '@/types'
import { PRO_GOAL_MAP } from '@/lib/proOnboarding'
import type { ProAssessmentResult } from '@/lib/proAssessment'

// ─── Stage 1: Global broad assessment ────────────────────────────────────────

/**
 * Fills the whole skill tree broadly from the 9 global benchmark fields.
 * Returns completed and current sets — does not write to DB.
 */
function assessFromBenchmarks(
  benchmarks: GlobalBenchmarks,
): { completed: Set<string>; current: Set<string> } {
  const completed = new Set<string>()
  const current   = new Set<string>()

  const { pullUpsMax, pushUpsMax, dipsMax, pikePushUpsMax,
          canSkinTheCat, wallHandstandAny, pistolSquatAny,
          hangingLegRaisesMax, lSitLevel } = benchmarks

  // ── Pull: vertical pull chain ────────────────────────────────────────────
  // Maps pull-up count to foundation chain nodes.
  // All users doing pull-ups have dead hang and active hang.
  if (pullUpsMax >= 1) {
    completed.add('dead-hang')
    completed.add('active-hang')
    completed.add('pullup-negative')
    completed.add('banded-pullup')
    // Also infer ring-row since ring pull-ups require ring rows first
  }
  if (pullUpsMax >= 5) {
    completed.add('pullup')
    // Row chain: sufficient pull strength implies inverted row capability
    completed.add('row-bent-legs')
    completed.add('row-straight-legs')
  }
  if (pullUpsMax >= 8) {
    completed.add('row-elevated-legs')
    completed.add('ring-row')
    completed.add('ring-pullup')
  }
  if (pullUpsMax >= 10) {
    completed.add('explosive-pullup')
  }
  if (pullUpsMax >= 15) {
    completed.add('high-pullup')
  }

  // Pull chain current placement
  if (pullUpsMax === 0)       current.add('pullup-negative')
  else if (pullUpsMax <= 4)   current.add('pullup')
  else if (pullUpsMax <= 9)   current.add('explosive-pullup')
  else if (pullUpsMax <= 14)  current.add('high-pullup')

  // ── Push: horizontal push chain ─────────────────────────────────────────
  if (pushUpsMax >= 1)  { completed.add('incline-knee-pu'); completed.add('knee-pu') }
  if (pushUpsMax >= 5)  completed.add('incline-pu')
  if (pushUpsMax >= 10) completed.add('standard-pu')
  if (pushUpsMax >= 20) completed.add('explosive-pu')

  if (pushUpsMax === 0)       current.add('incline-knee-pu')
  else if (pushUpsMax <= 4)   current.add('incline-pu')
  else if (pushUpsMax <= 9)   current.add('standard-pu')
  else if (pushUpsMax <= 19)  current.add('explosive-pu')

  // ── Push: dip chain ─────────────────────────────────────────────────────
  if (dipsMax >= 1) {
    completed.add('bench-dip')
    completed.add('dip-negative')
    completed.add('banded-dip')
  }
  if (dipsMax >= 10) completed.add('dip')

  if (dipsMax === 0)     current.add('bench-dip')
  else if (dipsMax <= 9) current.add('dip')

  // ── Push: vertical push / pike chain ───────────────────────────────────
  if (pikePushUpsMax >= 1)  completed.add('elevated-pike-pu')
  if (pikePushUpsMax >= 5)  completed.add('pike-pu')
  if (pikePushUpsMax >= 10) completed.add('decline-pike-pu')

  if (pikePushUpsMax === 0)      current.add('elevated-pike-pu')
  else if (pikePushUpsMax <= 4)  current.add('pike-pu')
  else if (pikePushUpsMax <= 9)  current.add('decline-pike-pu')
  else                           current.add('decline-pike-parall')

  // ── Skill checkpoints ────────────────────────────────────────────────────

  // Skin-the-cat → fills back lever prep chain
  if (canSkinTheCat) {
    completed.add('arch-hang')
    completed.add('skin-the-cat')
    current.add('german-hang')
  } else {
    // Can likely hang but not rotate yet
    if (pullUpsMax >= 1) current.add('arch-hang')
  }

  // Wall handstand → fills handstand prep chain
  if (wallHandstandAny) {
    completed.add('wall-plank')
    completed.add('kick-to-wall-hs')
    current.add('chest-to-wall-hs')  // at minimum, working toward 30s hold
  } else {
    current.add('wall-plank')
  }

  // Pistol squat → fills squat chain
  completed.add('bodyweight-squat')
  completed.add('deep-squat')
  completed.add('reverse-lunge')
  if (pistolSquatAny) {
    completed.add('bulgarian-split-squat')
    completed.add('pistol-hand-assist')
    current.add('pistol-opp-leg-free')
  } else {
    current.add('bulgarian-split-squat')
  }

  // Hanging leg raises → fills leg-raise and hollow body chains
  if (hangingLegRaisesMax >= 1) {
    completed.add('knee-raises')
    completed.add('knee-raises-one-leg')
    completed.add('standard-leg-raises')
    completed.add('hollow-hands-side')
  }
  if (hangingLegRaisesMax >= 5) {
    completed.add('hollow-hands-overhead')
  }

  if (hangingLegRaisesMax === 0) current.add('knee-raises')
  else current.add('toes-to-bar')  // next challenge after standard leg raises

  // L-sit level → fills the L-sit chain for everyone
  assessLSitLevelInto(lSitLevel, completed, current)

  return { completed, current }
}

/** Fills the L-sit chain from a milestone level. */
function assessLSitLevelInto(
  level: LSitLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  const pikes = ['pike-lift-lean-one-leg', 'pike-lift-one-leg', 'pike-lift-both-legs']
  const early = ['l-sit-foot-supported', 'l-sit-one-leg']

  if (level === 'none') {
    current.add('pike-lift-lean-one-leg')
    return
  }
  // Any L-sit hold → pike lifts and early stages cleared
  for (const id of [...pikes, ...early]) completed.add(id)

  if (level === 'brief') {
    current.add('l-sit-full')
    return
  }
  completed.add('l-sit-full')
  if (level === '5s') {
    current.add('l-sit-10sec')
    return
  }
  completed.add('l-sit-10sec')
  if (level === '10s') {
    current.add('l-sit-30sec')
    return
  }
  // '30s' → goal achieved
  completed.add('l-sit-30sec')
}

// ─── Stage 2: Goal-specific refinement ───────────────────────────────────────
// Each assessor takes a milestone level and ADDS to the existing completed/current
// sets. It never removes nodes set by stage 1.

function refineFrontLever(
  level: FrontLeverLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // Conservative: level = X means the user HAS achieved X, so place ABOVE it.
  // Pull chain prerequisites are already inferred from pullUpsMax in stage 1.
  const chain = ['tuck-fl', 'adv-tuck-fl', 'one-leg-fl', 'straddle-fl', 'full-fl']
  const cutoff: Record<FrontLeverLevel, number> = {
    'none':     -1,   // current: tuck-fl
    'tuck':      0,   // completed tuck → current: adv-tuck-fl
    'one-leg':   2,   // completed tuck + adv-tuck + one-leg → current: straddle-fl
    'straddle':  3,   // completed through straddle → current: full-fl
    'full':      4,   // all completed
  }
  const idx = cutoff[level]
  for (let i = 0; i <= idx; i++) completed.add(chain[i])
  if (idx < chain.length - 1) current.add(chain[idx + 1])
}

function refineBackLever(
  canSkinTheCat: boolean,      // from global benchmarks (already applied in stage 1)
  level: BackLeverLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // arch-hang and skin-the-cat are already handled by canSkinTheCat in stage 1.
  // german-hang is set as current by stage 1 if canSkinTheCat = true.
  // Here we only extend further if the user has back lever positions.
  if (!canSkinTheCat || level === 'none') return  // stage 1 placement stands

  const blChain = ['german-hang', 'tuck-bl', 'adv-tuck-bl', 'one-leg-bl', 'full-bl']
  const cutoff: Record<Exclude<BackLeverLevel, 'none'>, number> = {
    'tuck':     0,   // completed german-hang → current: tuck-bl
    'adv-tuck': 1,   // completed through tuck-bl → current: adv-tuck-bl
    'one-leg':  2,
    'full':     3,
  }
  const idx = cutoff[level as Exclude<BackLeverLevel, 'none'>]
  for (let i = 0; i <= idx; i++) completed.add(blChain[i])
  if (idx < blChain.length - 1) current.add(blChain[idx + 1])
}

function refineHandstand(
  level: HandstandLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // Stage 1 already sets wall-plank/kick-to-wall-hs based on wallHandstandAny.
  // Refinement gives more precision within the chain.
  const chain = ['wall-plank', 'kick-to-wall-hs', 'chest-to-wall-hs', 'hs-kick-balance', 'freestanding-hs']
  const cutoff: Record<HandstandLevel, number> = {
    'none':         -1,  // current: wall-plank (override stage 1's chest-to-wall-hs current)
    'wall':          2,  // can hold wall HS → completed through chest-to-wall → current: hs-kick-balance
    'kick-balance':  3,  // current: freestanding-hs
    'freestanding':  4,  // all completed
  }
  const idx = cutoff[level]
  // Clear previous stage 1 current nodes for this chain before setting refined position
  for (const id of chain) current.delete(id)
  for (let i = 0; i <= idx; i++) completed.add(chain[i])
  if (idx < chain.length - 1) current.add(chain[idx + 1])
}

function refinePlanche(
  level: PlancheLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // Push foundations (explosive-pu ancestry) inferred from pushUpsMax in stage 1.
  const chain = ['planche-lean', 'frog-stand', 'pseudo-planche-pu', 'tuck-planche', 'adv-tuck-planche']
  const cutoff: Record<PlancheLevel, number> = {
    'none':     -1,
    'lean':      0,
    'frog':      1,
    'tuck':      2,  // any tuck hold → pseudo-planche-pu inferred cleared
    'adv-tuck':  3,
  }
  const idx = cutoff[level]
  for (let i = 0; i <= idx; i++) completed.add(chain[i])
  if (idx < chain.length - 1) current.add(chain[idx + 1])
}

function refineRingMU(
  level:       RingMULevel,
  ringDipsMax: number,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // ring-mu requires both false-grip pull chain AND ring-dip.
  // Pull chain
  const pullChain = ['false-grip-hang', 'false-grip-pullup', 'ring-negative-mu', 'ring-mu']
  const cutoff: Record<RingMULevel, number> = {
    'none':               -1,
    'false-grip-hang':     0,  // working on hang — place AT hang
    'false-grip-pullup':   1,  // hang cleared → current: ring-negative-mu
    'ring-negative':       2,
    'ring-mu':             3,
  }
  const pullIdx = cutoff[level]
  for (let i = 0; i < pullIdx; i++) completed.add(pullChain[i])
  // Level 'false-grip-hang' means they're working on it, not past it
  if (level === 'false-grip-hang') {
    current.add('false-grip-hang')
  } else if (pullIdx >= 1) {
    completed.add(pullChain[pullIdx - 1])
    // ring-mu needs ring-dip too — block if not ready
    if (level === 'ring-negative' && ringDipsMax >= 5) {
      current.add('ring-mu')
    } else if (level !== 'ring-mu') {
      current.add(pullChain[pullIdx])
    }
  }
  if (level === 'ring-mu') for (const id of pullChain) completed.add(id)

  // Push side (ring dip chain)
  if (ringDipsMax >= 5) {
    completed.add('ring-support-hold')
    completed.add('ring-dip')
  } else if (ringDipsMax > 0) {
    completed.add('ring-support-hold')
    current.add('ring-dip')
  }
}

function refinePistolSquat(
  level: PistolSquatLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  // squat chain base is already filled in stage 1 (everyone gets bodyweight-squat, deep-squat, reverse-lunge).
  // If pistolSquatAny = true, stage 1 puts user at pistol-opp-leg-free.
  // Refinement gives finer placement.
  const map: Record<PistolSquatLevel, { done: string[]; curr: string | null }> = {
    'none':     { done: ['bodyweight-squat', 'deep-squat', 'reverse-lunge', 'bulgarian-split-squat'], curr: 'pistol-hand-assist' },
    'assisted': { done: ['bodyweight-squat', 'deep-squat', 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist'], curr: 'pistol-opp-leg-free' },
    'elevated': { done: ['bodyweight-squat', 'deep-squat', 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist', 'pistol-opp-leg-free'], curr: 'elevated-pistol' },
    'full':     { done: ['bodyweight-squat', 'deep-squat', 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist', 'pistol-opp-leg-free', 'elevated-pistol'], curr: 'standard-pistol' },
  }
  const { done, curr } = map[level]
  // Clear stage 1's coarser placement for this chain
  current.delete('bulgarian-split-squat')
  current.delete('pistol-opp-leg-free')
  for (const id of done) completed.add(id)
  if (curr) current.add(curr)
}

function refineShrimpSquat(
  level: ShrimpSquatLevel,
  completed: Set<string>,
  current:   Set<string>,
): void {
  const map: Record<ShrimpSquatLevel, { done: string[]; curr: string | null }> = {
    'none':     { done: [], curr: 'shrimp-squat-assisted' },
    'assisted': { done: ['shrimp-squat-assisted'], curr: 'shrimp-squat-free' },
    'free':     { done: ['shrimp-squat-assisted', 'shrimp-squat-free'], curr: 'shrimp-squat' },
    'full':     { done: ['shrimp-squat-assisted', 'shrimp-squat-free', 'shrimp-squat'], curr: null },
  }
  const { done, curr } = map[level]
  // Foundation nodes (inferred from pistolSquatAny in stage 1, or add here)
  completed.add('bodyweight-squat')
  completed.add('deep-squat')
  if (level !== 'none') {
    completed.add('reverse-lunge')
    completed.add('bulgarian-split-squat')
  }
  for (const id of done) completed.add(id)
  if (curr) current.add(curr)
}

// ─── Combined assessor ────────────────────────────────────────────────────────

/**
 * Full v2 assessment. Returns the same ProAssessmentResult shape as v1
 * so the review page, save API, and planner need no changes.
 */
export function assessProUserV2(data: ProOnboardingDataV2): ProAssessmentResult {
  const { benchmarks, refinement } = data
  const allGoals = [data.primaryGoal, ...data.secondaryGoals]
  const goalSet  = new Set<ProGoalId>(allGoals)

  // Stage 1 — broad fill
  const { completed, current } = assessFromBenchmarks(benchmarks)

  // Stage 2 — goal-specific refinement
  if (goalSet.has('front-lever') && refinement.frontLeverLevel) {
    refineFrontLever(refinement.frontLeverLevel, completed, current)
  }

  if (goalSet.has('back-lever') && refinement.backLeverLevel) {
    refineBackLever(benchmarks.canSkinTheCat, refinement.backLeverLevel, completed, current)
  }

  if ((goalSet.has('handstand') || goalSet.has('handstand-pushup')) && refinement.handstandLevel) {
    refineHandstand(refinement.handstandLevel, completed, current)
  }

  if (goalSet.has('planche') && refinement.plancheLevel) {
    refinePlanche(refinement.plancheLevel, completed, current)
  }

  if (goalSet.has('ring-muscle-up') && refinement.ringMULevel) {
    refineRingMU(
      refinement.ringMULevel,
      refinement.ringDipsMax ?? 0,
      completed,
      current,
    )
  }

  if (goalSet.has('pistol-squat') && refinement.pistolSquatLevel) {
    refinePistolSquat(refinement.pistolSquatLevel, completed, current)
  }

  if (goalSet.has('shrimp-squat') && refinement.shrimpSquatLevel) {
    refineShrimpSquat(refinement.shrimpSquatLevel, completed, current)
  }

  // L-sit and muscle-up need no goal-specific refinement — stage 1 covers them fully.

  // Resolve conflicts: completed always beats current
  for (const id of completed) current.delete(id)

  // Map selected goals to terminal skill tree node IDs
  const goalNodeIds = allGoals
    .map(id => PRO_GOAL_MAP.get(id)?.terminalNodeId)
    .filter((id): id is string => id !== undefined)

  return {
    completedNodeIds: Array.from(completed),
    currentNodeIds:   Array.from(current),
    goalNodeIds,
  }
}
