// lib/proAssessment.ts
// Converts pro onboarding answers into skill tree node states.
//
// Design principles:
//   - Rule-based and deterministic — no AI, no randomness.
//   - Conservative: do not overclaim advanced nodes if evidence is weak.
//   - One helper per major chain — easier to test and adjust thresholds.
//   - Base foundational nodes (dead-hang, rows, etc.) are only inferred when
//     the user selected a goal that actually uses those chains.
//   - A node cannot be both completed AND current; completed always wins.
//
// Output is a plain object — no database writes happen here.

import type { ProGoalId, ProOnboardingData } from '@/types'
import { PRO_GOAL_MAP } from './proOnboarding'

// ─── Output type ──────────────────────────────────────────────────────────────

export interface ProAssessmentResult {
  /** Nodes the user has clearly passed based on their assessment answers. */
  completedNodeIds: string[]
  /** Nodes the user is actively working on — one per chain at most. */
  currentNodeIds:   string[]
  /** Terminal skill tree node IDs for each selected goal. */
  goalNodeIds:      string[]
}

// ─── Internal chain result ────────────────────────────────────────────────────

interface ChainResult {
  completed: string[]
  current:   string | null
}

// ─── Chain assessors ──────────────────────────────────────────────────────────
// Each assessor is exported so it can be unit-tested independently.
// Thresholds are based on the assessment targets defined in lib/skillTree.ts.

/**
 * Muscle-up chain:
 * pullup-negative → banded-pullup → pullup → explosive-pullup → high-pullup → negative-mu → kipping-mu → strict-mu
 *
 * Thresholds:
 *   <5 pull-ups  → working on pull-up
 *   5–9          → working on explosive pull-up (consistent reps = enough)
 *   10–14        → working on high pull-up (chest-to-bar)
 *   15+          → ready for muscle-up negatives
 */
export function assessMuscleUpProgress(pullUpsMax: number): ChainResult {
  if (pullUpsMax === 0) {
    return { completed: [], current: 'pullup-negative' }
  }
  if (pullUpsMax <= 4) {
    return {
      completed: ['pullup-negative', 'banded-pullup'],
      current: 'pullup',
    }
  }
  if (pullUpsMax <= 9) {
    return {
      completed: ['pullup-negative', 'banded-pullup', 'pullup'],
      current: 'explosive-pullup',
    }
  }
  if (pullUpsMax <= 14) {
    return {
      completed: ['pullup-negative', 'banded-pullup', 'pullup', 'explosive-pullup'],
      current: 'high-pullup',
    }
  }
  // 15+ pull-ups → foundation for muscle-up negatives
  return {
    completed: ['pullup-negative', 'banded-pullup', 'pullup', 'explosive-pullup', 'high-pullup'],
    current: 'negative-mu',
  }
}

/**
 * Front lever chain:
 * (row-elevated-legs prerequisite) → tuck-fl → adv-tuck-fl → one-leg-fl → straddle-fl → full-fl
 *
 * Targets from skillTree.ts:
 *   tuck-fl:     10s
 *   adv-tuck-fl: 10s (inferred — no separate question)
 *   one-leg-fl:   5s
 *   straddle-fl:  5s
 *   full-fl:      5s
 *
 * Placement rules (conservative):
 *   pullUpsMax < 3               → not ready for lever chain; send to row prerequisite
 *   tuckFLSeconds < 10           → current: tuck-fl
 *   tuckFLSeconds ≥ 10, oneLeg = 0    → completed: [tuck-fl], current: adv-tuck-fl
 *   tuckFLSeconds ≥ 10, oneLeg 1–4s   → completed: [tuck-fl, adv-tuck-fl], current: one-leg-fl
 *   tuckFLSeconds ≥ 10, oneLeg ≥ 5s, straddle = 0 → current: straddle-fl
 *   tuckFLSeconds ≥ 10, oneLeg ≥ 5s, straddle ≥ 5s → current: full-fl
 */
export function assessFrontLeverProgress(
  pullUpsMax:           number,
  tuckFrontLeverSeconds: number,
  oneLegFLSeconds:      number,
  straddleFLSeconds:    number,
): ChainResult {
  // Below 3 pull-ups → not ready for the lever chain yet; send to prerequisite
  if (pullUpsMax < 3) {
    return { completed: [], current: 'row-bent-legs' }
  }

  if (tuckFrontLeverSeconds < 10) {
    // 0 = hasn't started; 1–9 = working toward 10s target
    return { completed: [], current: 'tuck-fl' }
  }

  // tuck FL ≥ 10s → passed; check one-leg hold to distinguish adv-tuck vs beyond
  if (oneLegFLSeconds === 0) {
    return { completed: ['tuck-fl'], current: 'adv-tuck-fl' }
  }

  // Any one-leg FL hold → adv-tuck is cleared
  if (oneLegFLSeconds < 5) {
    // 1–4s: working toward the 5s one-leg target
    return { completed: ['tuck-fl', 'adv-tuck-fl'], current: 'one-leg-fl' }
  }

  // one-leg FL ≥ 5s → passed; check straddle
  if (straddleFLSeconds < 5) {
    // 0–4s: at or working toward straddle (0 = hasn't started straddle yet)
    return { completed: ['tuck-fl', 'adv-tuck-fl', 'one-leg-fl'], current: 'straddle-fl' }
  }

  // straddle FL ≥ 5s → passed; working full front lever
  return {
    completed: ['tuck-fl', 'adv-tuck-fl', 'one-leg-fl', 'straddle-fl'],
    current: 'full-fl',
  }
}

/**
 * Back lever chain:
 * arch-hang → skin-the-cat → german-hang → tuck-bl → adv-tuck-bl → one-leg-bl → full-bl
 *
 * Targets from skillTree.ts:
 *   arch-hang:     20s
 *   skin-the-cat:   5 reps
 *   german-hang:   10s
 *   tuck-bl:       10s
 *   adv-tuck-bl:   10s
 *   one-leg-bl:     5s
 *   full-bl:        5s
 *
 * Placement rules (conservative):
 *   skinTheCat = 0                              → current: arch-hang (chain entry)
 *   skinTheCat 1–4                             → current: skin-the-cat
 *   skinTheCat ≥ 5, tuckBL = 0                → current: german-hang
 *   skinTheCat ≥ 5, tuckBL 1–9s              → current: tuck-bl
 *   skinTheCat ≥ 5, tuckBL ≥ 10s, advTuck < 10s → current: adv-tuck-bl
 *   tuckBL ≥ 10s, advTuck ≥ 10s, oneLeg < 5s   → current: one-leg-bl
 *   tuckBL ≥ 10s, advTuck ≥ 10s, oneLeg ≥ 5s   → current: full-bl
 */
export function assessBackLeverProgress(
  skinTheCat:           number,
  tuckBackLeverSeconds: number,
  advTuckBLSeconds:     number,
  oneLegBLSeconds:      number,
): ChainResult {
  if (skinTheCat === 0) {
    // Haven't started skin-the-cat — arch-hang is the chain entry for back lever prep
    return { completed: [], current: 'arch-hang' }
  }
  if (skinTheCat < 5) {
    // 1–4 reps: arch-hang is clearly mastered, working toward 5-rep target
    return { completed: ['arch-hang'], current: 'skin-the-cat' }
  }

  // skinTheCat ≥ 5 → arch-hang + skin-the-cat passed
  if (tuckBackLeverSeconds === 0) {
    return { completed: ['arch-hang', 'skin-the-cat'], current: 'german-hang' }
  }
  if (tuckBackLeverSeconds < 10) {
    return { completed: ['arch-hang', 'skin-the-cat', 'german-hang'], current: 'tuck-bl' }
  }

  // tuck BL ≥ 10s → tuck-bl passed; use advTuck to distinguish adv-tuck vs beyond
  if (advTuckBLSeconds < 10) {
    // 0 = hasn't started; 1–9s = working toward 10s adv-tuck target
    return { completed: ['arch-hang', 'skin-the-cat', 'german-hang', 'tuck-bl'], current: 'adv-tuck-bl' }
  }

  // adv-tuck BL ≥ 10s → adv-tuck-bl passed; use oneLeg to distinguish
  if (oneLegBLSeconds < 5) {
    // 0 = hasn't started; 1–4s = working toward 5s one-leg target
    return {
      completed: ['arch-hang', 'skin-the-cat', 'german-hang', 'tuck-bl', 'adv-tuck-bl'],
      current: 'one-leg-bl',
    }
  }

  // one-leg BL ≥ 5s → passed; working full back lever
  return {
    completed: ['arch-hang', 'skin-the-cat', 'german-hang', 'tuck-bl', 'adv-tuck-bl', 'one-leg-bl'],
    current: 'full-bl',
  }
}

/**
 * Handstand chain:
 * wall-plank → kick-to-wall-hs → chest-to-wall-hs → hs-kick-balance → freestanding-hs
 *
 * Targets from skillTree.ts:
 *   chest-to-wall-hs:  30s
 *   hs-kick-balance:    5s
 *   freestanding-hs:   10s
 *   press-handstand:    1 rep (different metric — not inferred here)
 *
 * Placement rules (conservative):
 *   wallHS = 0                         → current: wall-plank
 *   wallHS 1–29s                       → current: chest-to-wall-hs (kick-up + wall-plank cleared)
 *   wallHS ≥ 30s, freestandingHS = 0   → current: hs-kick-balance
 *   wallHS ≥ 30s, freestandingHS 1–9s  → current: freestanding-hs (working toward 10s target)
 *   wallHS ≥ 30s, freestandingHS ≥ 10s → freestanding-hs completed; goal achieved (current: null)
 *
 * press-handstand is not inferred — it requires a reps-based measure not collected
 * here, and the handstand ProGoal terminates at freestanding-hs.
 */
export function assessHandstandProgress(
  wallHandstandSeconds:         number,
  freestandingHandstandSeconds: number,
): ChainResult {
  if (wallHandstandSeconds === 0) {
    return { completed: [], current: 'wall-plank' }
  }

  if (wallHandstandSeconds < 30) {
    // Any hold > 0 means kick-up and wall-plank are cleared
    return {
      completed: ['wall-plank', 'kick-to-wall-hs'],
      current: 'chest-to-wall-hs',
    }
  }

  // ≥ 30s → chest-to-wall passed; use freestanding hold to distinguish further
  if (freestandingHandstandSeconds === 0) {
    return {
      completed: ['wall-plank', 'kick-to-wall-hs', 'chest-to-wall-hs'],
      current: 'hs-kick-balance',
    }
  }

  if (freestandingHandstandSeconds < 10) {
    // 1–9s: hs-kick-balance is cleared, working toward 10s freestanding target
    return {
      completed: ['wall-plank', 'kick-to-wall-hs', 'chest-to-wall-hs', 'hs-kick-balance'],
      current: 'freestanding-hs',
    }
  }

  // ≥ 10s → freestanding-hs passed (handstand ProGoal achieved)
  return {
    completed: ['wall-plank', 'kick-to-wall-hs', 'chest-to-wall-hs', 'hs-kick-balance', 'freestanding-hs'],
    current: null,
  }
}

/**
 * HSPU chain:
 * elevated-pike-pu → pike-pu → decline-pike-pu → decline-pike-parall → wall-assisted-hspu → hspu
 *
 * HSPU requires BOTH push strength (pike chain) AND handstand balance.
 * Cross-branch dependency: must check wallHandstandSeconds alongside pikePushUpsMax.
 *
 * Thresholds:
 *   pike push-ups 0   → start at elevated pike push-up
 *   pike push-ups 1–4 → working on pike push-up
 *   pike push-ups 5–9 → working on decline pike
 *   pike push-ups ≥ 10 + wall HS ≥ 5s  → wall-assisted HSPU
 *   pike push-ups ≥ 10 + wall HS ≥ 30s → HSPU
 */
export function assessHSPUProgress(
  pikePushUpsMax: number,
  wallHandstandSeconds: number,
): ChainResult {
  if (pikePushUpsMax === 0) {
    return { completed: [], current: 'elevated-pike-pu' }
  }
  if (pikePushUpsMax <= 4) {
    return { completed: ['elevated-pike-pu'], current: 'pike-pu' }
  }
  if (pikePushUpsMax <= 9) {
    return { completed: ['elevated-pike-pu', 'pike-pu'], current: 'decline-pike-pu' }
  }
  // pikePushUpsMax ≥ 10 — check handstand readiness
  if (wallHandstandSeconds >= 30) {
    return {
      completed: ['elevated-pike-pu', 'pike-pu', 'decline-pike-pu', 'decline-pike-parall', 'wall-assisted-hspu'],
      current: 'hspu',
    }
  }
  if (wallHandstandSeconds >= 5) {
    return {
      completed: ['elevated-pike-pu', 'pike-pu', 'decline-pike-pu', 'decline-pike-parall'],
      current: 'wall-assisted-hspu',
    }
  }
  // Strong pike push-ups but handstand not ready — stay at decline-pike-parall
  return {
    completed: ['elevated-pike-pu', 'pike-pu', 'decline-pike-pu'],
    current: 'decline-pike-parall',
  }
}

/**
 * L-sit chain:
 * pike-lift-lean-one-leg → pike-lift-one-leg → pike-lift-both-legs
 * → l-sit-foot-supported → l-sit-one-leg → l-sit-full → l-sit-10sec → l-sit-30sec
 *
 * Thresholds (from skillTree.ts assessment targets):
 *   = 0s         → can't hold yet; start at pike lifts
 *   1–4s         → can hold briefly; pike lifts and foot-supported stages are cleared
 *   5–9s         → passed l-sit-full (target: 5s)
 *   10–29s       → passed l-sit-10sec (target: 10s)
 *   ≥ 30s        → passed l-sit-30sec (target: 30s) — goal complete
 */
export function assessLSitProgress(lSitSeconds: number): ChainResult {
  if (lSitSeconds === 0) {
    return { completed: [], current: 'pike-lift-lean-one-leg' }
  }
  if (lSitSeconds < 5) {
    return {
      completed: [
        'pike-lift-lean-one-leg', 'pike-lift-one-leg', 'pike-lift-both-legs',
        'l-sit-foot-supported', 'l-sit-one-leg',
      ],
      current: 'l-sit-full',
    }
  }
  if (lSitSeconds < 10) {
    return {
      completed: [
        'pike-lift-lean-one-leg', 'pike-lift-one-leg', 'pike-lift-both-legs',
        'l-sit-foot-supported', 'l-sit-one-leg', 'l-sit-full',
      ],
      current: 'l-sit-10sec',
    }
  }
  if (lSitSeconds < 30) {
    return {
      completed: [
        'pike-lift-lean-one-leg', 'pike-lift-one-leg', 'pike-lift-both-legs',
        'l-sit-foot-supported', 'l-sit-one-leg', 'l-sit-full', 'l-sit-10sec',
      ],
      current: 'l-sit-30sec',
    }
  }
  // ≥ 30s → goal complete
  return {
    completed: [
      'pike-lift-lean-one-leg', 'pike-lift-one-leg', 'pike-lift-both-legs',
      'l-sit-foot-supported', 'l-sit-one-leg', 'l-sit-full', 'l-sit-10sec', 'l-sit-30sec',
    ],
    current: null,
  }
}

/**
 * Pistol squat chain:
 * bodyweight-squat → deep-squat → bulgarian-split-squat
 * → pistol-hand-assist → pistol-opp-leg-free → elevated-pistol → standard-pistol
 *
 * Assumes anyone selecting pistol squat as a goal can do basic bodyweight squats.
 *
 * Thresholds:
 *   full pistol ≥ 5  → goal complete
 *   full pistol 1–4  → can do it, working on reps
 *   assisted ≥ 8     → ready for unassisted progression
 *   assisted 5–7     → working on opposing-leg-free variant
 *   assisted 1–4     → working on hand-assisted pistol
 *   assisted = 0     → working on reverse-lunge (new entry step before bulgarian)
 *
 * Tree change: reverse-lunge was added between deep-squat and bulgarian-split-squat.
 * Anyone who can do assisted pistols has clearly done lunges — include it in completed.
 */
export function assessPistolSquatProgress(
  pistolSquatAssisted: number,
  pistolSquatFull: number,
): ChainResult {
  const base = ['bodyweight-squat', 'deep-squat']

  if (pistolSquatFull >= 5) {
    return {
      completed: [...base, 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist', 'pistol-opp-leg-free', 'elevated-pistol', 'standard-pistol'],
      current: null,
    }
  }
  if (pistolSquatFull >= 1) {
    return {
      completed: [...base, 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist', 'pistol-opp-leg-free', 'elevated-pistol'],
      current: 'standard-pistol',
    }
  }
  if (pistolSquatAssisted >= 8) {
    return {
      completed: [...base, 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist', 'pistol-opp-leg-free'],
      current: 'elevated-pistol',
    }
  }
  if (pistolSquatAssisted >= 5) {
    return {
      completed: [...base, 'reverse-lunge', 'bulgarian-split-squat', 'pistol-hand-assist'],
      current: 'pistol-opp-leg-free',
    }
  }
  if (pistolSquatAssisted >= 1) {
    return {
      completed: [...base, 'reverse-lunge', 'bulgarian-split-squat'],
      current: 'pistol-hand-assist',
    }
  }
  // 0 assisted — start at reverse-lunge (entry step before bulgarian split squat)
  return { completed: base, current: 'reverse-lunge' }
}

/**
 * Planche chain:
 * planche-lean → frog-stand → pseudo-planche-pu → tuck-planche → adv-tuck-planche → …
 *
 * Targets from skillTree.ts:
 *   planche-lean:     30s
 *   frog-stand:       30s
 *   pseudo-planche-pu: 10 reps (inferred — no separate question; any tuck planche hold implies it's done)
 *   tuck-planche:     10s
 *   adv-tuck-planche: 10s
 *   straddle/full:    not inferred here (no question for those stages)
 *
 * Placement rules (conservative):
 *   plancheLean < 30s AND frogStand = 0 → current: planche-lean
 *   frogStand > 0 but < 30s            → current: frog-stand  (planche-lean treated as cleared)
 *   frogStand ≥ 30s, tuckPlanche = 0   → current: pseudo-planche-pu
 *   frogStand ≥ 30s, tuckPlanche 1–9s  → current: tuck-planche
 *   frogStand ≥ 30s, tuckPlanche ≥ 10s → current: adv-tuck-planche
 *
 * Push foundations (explosive-pu ancestry) are inferred in assessProUser, not here.
 */
export function assessPlancheProgress(
  plancheLeanSeconds: number,
  frogStandSeconds:   number,
  tuckPlancheSeconds: number,
): ChainResult {
  // If frogStand has been started, planche-lean is cleared regardless of exact lean seconds
  if (plancheLeanSeconds < 30 && frogStandSeconds === 0) {
    // 0 = hasn't started; < 30s = working toward target
    return { completed: [], current: 'planche-lean' }
  }

  if (frogStandSeconds < 30) {
    // planche-lean passed (or frog stand was started while still refining lean)
    return { completed: ['planche-lean'], current: 'frog-stand' }
  }

  // frog-stand ≥ 30s → passed
  if (tuckPlancheSeconds === 0) {
    return { completed: ['planche-lean', 'frog-stand'], current: 'pseudo-planche-pu' }
  }

  if (tuckPlancheSeconds < 10) {
    // any tuck planche hold → pseudo-planche-pu is cleared (reps inferred)
    return { completed: ['planche-lean', 'frog-stand', 'pseudo-planche-pu'], current: 'tuck-planche' }
  }

  // tuck planche ≥ 10s → passed; capped at adv-tuck-planche without further evidence
  return {
    completed: ['planche-lean', 'frog-stand', 'pseudo-planche-pu', 'tuck-planche'],
    current: 'adv-tuck-planche',
  }
}

/**
 * Ring muscle-up pull chain:
 * false-grip-hang → false-grip-pullup → ring-negative-mu → ring-mu
 *
 * ring-mu has prerequisites: ['ring-negative-mu', 'ring-dip']
 * ring-dip is a push-side node — its completion status is passed in so the
 * assessor can respect the cross-branch prerequisite.
 *
 * Targets from skillTree.ts:
 *   false-grip-hang:    10s
 *   false-grip-pullup:   5 reps
 *   ring-negative-mu:    3 reps (eccentrics)
 *   ring-mu:             1 rep
 *
 * Placement rules (conservative):
 *   falseGripHang < 10s         → current: false-grip-hang
 *   falseGripHang ≥ 10s, fg-pu < 5   → current: false-grip-pullup
 *   fg-pu ≥ 5 but ring-dip not cleared → current: ring-negative-mu
 *   fg-pu ≥ 5 AND ring-dips ≥ 5       → current: ring-mu
 */
export function assessRingMuscleUpProgress(
  falseGripHangSeconds: number,
  falseGripPullUpsMax:  number,
  ringDipsMax:          number,
): ChainResult {
  if (falseGripHangSeconds < 10) {
    // 0 = hasn't started; 1–9s = working toward 10s target
    return { completed: [], current: 'false-grip-hang' }
  }

  // false-grip-hang ≥ 10s → passed
  if (falseGripPullUpsMax < 5) {
    return { completed: ['false-grip-hang'], current: 'false-grip-pullup' }
  }

  // false-grip pull-ups ≥ 5 → passed; check ring-dip prerequisite for ring-mu
  if (ringDipsMax < 5) {
    // Pull chain is advanced but ring-dip not yet cleared — hold at ring-negative-mu
    return { completed: ['false-grip-hang', 'false-grip-pullup'], current: 'ring-negative-mu' }
  }

  // Both pull and push prerequisites met — ready for ring muscle-up
  return {
    completed: ['false-grip-hang', 'false-grip-pullup', 'ring-negative-mu'],
    current: 'ring-mu',
  }
}

/**
 * Shrimp squat chain:
 * shrimp-squat-assisted → shrimp-squat-free → shrimp-squat
 *
 * Placement rules (conservative):
 *   assisted = 0               → current: shrimp-squat-assisted
 *   assisted 1–4               → current: shrimp-squat-assisted (still building)
 *   assisted ≥ 5, full = 0     → completed: [assisted]; current: shrimp-squat-free
 *   full 1–4                   → completed: [assisted, free]; current: shrimp-squat
 *   full ≥ 5                   → goal complete (current: null)
 */
export function assessShrimpSquatProgress(
  shrimpSquatAssisted: number,
  shrimpSquatFull:     number,
): ChainResult {
  if (shrimpSquatFull >= 5) {
    return {
      completed: ['shrimp-squat-assisted', 'shrimp-squat-free', 'shrimp-squat'],
      current: null,
    }
  }
  if (shrimpSquatFull >= 1) {
    return {
      completed: ['shrimp-squat-assisted', 'shrimp-squat-free'],
      current: 'shrimp-squat',
    }
  }
  if (shrimpSquatAssisted >= 5) {
    return { completed: ['shrimp-squat-assisted'], current: 'shrimp-squat-free' }
  }
  // 0–4 assisted → working on the assisted variant
  return { completed: [], current: 'shrimp-squat-assisted' }
}

// ─── Main assessor ────────────────────────────────────────────────────────────

/**
 * Converts pro onboarding answers into skill tree node states.
 *
 * - Only infers nodes relevant to the user's selected goals.
 * - Completed beats current: if a node ends up in both sets, it is removed from current.
 * - Safe to call multiple times with the same data (pure function, no side effects).
 */
export function assessProUser(data: ProOnboardingData): ProAssessmentResult {
  const completed = new Set<string>()
  const current   = new Set<string>()

  const allGoals = [data.primaryGoal, ...data.secondaryGoals]
  const goalSet  = new Set<ProGoalId>(allGoals)

  function apply(result: ChainResult) {
    for (const id of result.completed) completed.add(id)
    if (result.current) current.add(result.current)
  }

  // ── Foundational pull nodes ──────────────────────────────────────────────
  // Only infer when a pull goal is selected — avoids polluting the tree for
  // users whose only goals are push/legs/core.
  const hasPullGoal =
    goalSet.has('muscle-up') || goalSet.has('front-lever') || goalSet.has('back-lever')

  if (hasPullGoal) {
    if (data.pullUpsMax >= 1) {
      completed.add('dead-hang')
      completed.add('active-hang')
      completed.add('pullup-negative')
    }
    if (data.pullUpsMax >= 5) completed.add('banded-pullup')
    if (data.pullUpsMax >= 8) completed.add('pullup')
  }

  // ── Row prerequisite nodes (required for FRONT lever only) ─────────────
  // Back lever branches from arch-hang (active-hang → arch-hang → skin-the-cat), not from rows.
  // Row strength is the specific prerequisite for front lever (scapular retraction).
  const hasFrontLeverGoal = goalSet.has('front-lever')

  if (hasFrontLeverGoal) {
    if (data.pullUpsMax >= 3) completed.add('row-bent-legs')
    if (data.pullUpsMax >= 5) completed.add('row-straight-legs')
    if (data.pullUpsMax >= 8) completed.add('row-elevated-legs')
  }

  // ── Dip prerequisite nodes (required for muscle-up) ─────────────────────
  // negative-mu has prerequisites: ['high-pullup', 'dip'] — so we need to infer
  // dip progress for muscle-up candidates so the prerequisite can be satisfied.
  if (goalSet.has('muscle-up')) {
    if (data.dipsMax >= 1) {
      completed.add('bench-dip')
      completed.add('dip-negative')
      completed.add('banded-dip')
    }
    if (data.dipsMax >= 10) completed.add('dip')
  }

  // ── Foundational push nodes (required for planche) ──────────────────────
  // planche-lean.parentId = 'explosive-pu', so we infer the full horizontal-push
  // ancestry from pushUpsMax, or directly from planche progress evidence.
  if (goalSet.has('planche')) {
    const hasPlancheEvidence =
      data.plancheLeanSeconds > 0 || data.frogStandSeconds > 0 || data.tuckPlancheSeconds > 0
    if (data.pushUpsMax >= 1 || hasPlancheEvidence) {
      completed.add('incline-knee-pu')
      completed.add('knee-pu')
    }
    if (data.pushUpsMax >= 5  || hasPlancheEvidence) completed.add('incline-pu')
    if (data.pushUpsMax >= 10 || hasPlancheEvidence) completed.add('standard-pu')
    if (data.pushUpsMax >= 20 || hasPlancheEvidence) completed.add('explosive-pu')
  }

  // ── Goal-specific chain assessments ─────────────────────────────────────

  if (goalSet.has('muscle-up')) {
    apply(assessMuscleUpProgress(data.pullUpsMax))
  }

  if (goalSet.has('front-lever')) {
    apply(assessFrontLeverProgress(
      data.pullUpsMax,
      data.tuckFrontLeverSeconds,
      data.oneLegFLSeconds,
      data.straddleFLSeconds,
    ))
  }

  if (goalSet.has('back-lever')) {
    apply(assessBackLeverProgress(
      data.skinTheCat,
      data.tuckBackLeverSeconds,
      data.advTuckBLSeconds,
      data.oneLegBLSeconds,
    ))
  }

  // Run handstand assessment once if either handstand goal is selected
  if (goalSet.has('handstand') || goalSet.has('handstand-pushup')) {
    apply(assessHandstandProgress(data.wallHandstandSeconds, data.freestandingHandstandSeconds))
  }

  if (goalSet.has('handstand-pushup')) {
    apply(assessHSPUProgress(data.pikePushUpsMax, data.wallHandstandSeconds))
  }

  if (goalSet.has('l-sit')) {
    apply(assessLSitProgress(data.lSitSeconds))
  }

  if (goalSet.has('pistol-squat')) {
    apply(assessPistolSquatProgress(data.pistolSquatAssisted, data.pistolSquatFull))
  }

  if (goalSet.has('planche')) {
    apply(assessPlancheProgress(
      data.plancheLeanSeconds,
      data.frogStandSeconds,
      data.tuckPlancheSeconds,
    ))
  }

  // ── Ring muscle-up ───────────────────────────────────────────────────────
  // Dual requirement: pull chain (false grip) + push chain (ring dip).
  // Both sides are inferred here so the UI can show the full prerequisite state.
  if (goalSet.has('ring-muscle-up')) {
    // Pull foundations — any false-grip work implies ring pull ancestry is cleared
    if (data.falseGripHangSeconds > 0 || data.falseGripPullUpsMax > 0) {
      for (const id of [
        'dead-hang', 'active-hang', 'pullup-negative', 'banded-pullup', 'pullup',
        'row-bent-legs', 'row-straight-legs', 'row-elevated-legs', 'ring-row', 'ring-pullup',
      ]) completed.add(id)
    }
    // Dip chain — ring-dip requires bar dip; infer from dipsMax
    if (data.dipsMax >= 1) {
      completed.add('bench-dip')
      completed.add('dip-negative')
      completed.add('banded-dip')
    }
    if (data.dipsMax >= 10) completed.add('dip')
    // Ring support hold chain
    if (data.ringSupportHoldSeconds >= 30 || data.ringDipsMax > 0) {
      completed.add('ring-support-hold')
    } else if (data.ringSupportHoldSeconds > 0) {
      current.add('ring-support-hold')
    }
    // Ring dip
    if (data.ringDipsMax >= 5) {
      completed.add('ring-dip')
    } else if (data.ringDipsMax > 0) {
      current.add('ring-dip')
    }
    // Pull chain assessment
    apply(assessRingMuscleUpProgress(
      data.falseGripHangSeconds,
      data.falseGripPullUpsMax,
      data.ringDipsMax,
    ))
  }

  // ── Foundational squat nodes (required for shrimp squat) ────────────────
  // shrimp-squat-assisted.parentId = 'bulgarian-split-squat', so we infer
  // the squat/lunge ancestry from any shrimp squat evidence.
  if (goalSet.has('shrimp-squat')) {
    // Anyone selecting shrimp squat can do basic squats
    completed.add('bodyweight-squat')
    completed.add('deep-squat')
    // Any assisted or full reps → lunge prerequisites are clearly cleared
    if (data.shrimpSquatAssisted >= 1 || data.shrimpSquatFull >= 1) {
      completed.add('reverse-lunge')
      completed.add('bulgarian-split-squat')
    }
    apply(assessShrimpSquatProgress(data.shrimpSquatAssisted, data.shrimpSquatFull))
  }

  // ── Resolve conflicts: completed always beats current ────────────────────
  for (const id of completed) current.delete(id)

  // ── Map selected goals to their terminal skill tree node IDs ────────────
  const goalNodeIds = allGoals
    .map(id => PRO_GOAL_MAP.get(id)?.terminalNodeId)
    .filter((id): id is string => id !== undefined)

  return {
    completedNodeIds: Array.from(completed),
    currentNodeIds:   Array.from(current),
    goalNodeIds,
  }
}
