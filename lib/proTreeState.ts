// lib/proTreeState.ts
// Converts ProAssessmentResult into the { progress, activeSkills } shape
// expected by SkillTree and SkillTreePage components.
//
// Kept as a standalone helper so the review page, and later the save-to-DB
// flow, can both call it without duplicating the conversion logic.

import type { ProgressStatus } from '@/types'
import type { ProAssessmentResult } from './proAssessment'
import { getSkillChain, findBestSkillStep } from './skillTree'

export interface TreeState {
  /** Maps nodeId → "completed" | "current" */
  progress:     Record<string, ProgressStatus>
  /**
   * Maps terminal goal nodeId → best current progression step.
   * Shape expected by SkillTree's activeSkills prop.
   */
  activeSkills: Record<string, string>
}

/**
 * Normalizes the progress map for a single goal's isSkillGoal chain.
 *
 * Assessment functions set nodes individually via threshold rules and can leave
 * the chain in an inconsistent state:
 *   - A "current" node whose predecessors in the chain were never marked completed
 *   - A chain that ends with "completed" nodes but no "current" (user is stuck
 *     in limbo — next step exists but is unset, so the tree shows it as locked)
 *
 * This pass enforces two rules within the isSkillGoal chain for each goal:
 *   1. All nodes before the high-water-mark are set to "completed".
 *   2. If the high-water-mark node is "completed" and the chain isn't finished,
 *      the next node is set to "current".
 *
 * "High water mark" = the rightmost node in the chain that has any status
 * (completed or current).
 *
 * Alternative nodes and cross-branch prerequisites (e.g. ring-dip for ring-mu)
 * sit outside the isSkillGoal chain and are intentionally left untouched — the
 * assessment handles them independently.
 */
function normalizeGoalChain(
  goalNodeId: string,
  progress: Record<string, ProgressStatus>,
): void {
  const chain = getSkillChain(goalNodeId)
  if (chain.length === 0) return

  // Find the high water mark: rightmost index in the chain with any status.
  let hwm = -1
  for (let i = 0; i < chain.length; i++) {
    if (progress[chain[i]] === 'completed' || progress[chain[i]] === 'current') {
      hwm = i
    }
  }

  // No progress in this chain yet — nothing to normalize.
  if (hwm === -1) return

  // Rule 1: every node before the high water mark must be completed.
  for (let i = 0; i < hwm; i++) {
    progress[chain[i]] = 'completed'
  }

  // Rule 2: if the high water mark node is completed and the chain has more
  // steps, advance current to the very next step (unless it already has a
  // status, e.g. it's already completed via a different code path).
  if (progress[chain[hwm]] === 'completed' && hwm < chain.length - 1) {
    if (!progress[chain[hwm + 1]]) {
      progress[chain[hwm + 1]] = 'current'
    }
  }
}

export function buildTreeStateFromAssessment(result: ProAssessmentResult): TreeState {
  const progress: Record<string, ProgressStatus> = {}

  for (const id of result.completedNodeIds) progress[id] = 'completed'
  for (const id of result.currentNodeIds)   progress[id] = 'current'

  // Normalize each goal's isSkillGoal chain to enforce internal consistency.
  // This catches two classes of assessment gap:
  //   a) predecessors of a "current" node that were never marked completed
  //   b) a chain that ends on a "completed" node with no "current" advancement
  //      (e.g. V2 muscle-up: pullUpsMax ≥ 15 → high-pullup completed,
  //       but negative-mu was never placed because muscle-up has no V2 refinement)
  for (const goalId of result.goalNodeIds) {
    normalizeGoalChain(goalId, progress)
  }

  // findBestSkillStep expects Record<string, string> — cast is safe since
  // ProgressStatus values are strings ("completed" | "current").
  const progressMap = progress as Record<string, string>

  const activeSkills: Record<string, string> = {}
  for (const goalId of result.goalNodeIds) {
    activeSkills[goalId] = findBestSkillStep(goalId, progressMap)
  }

  return { progress, activeSkills }
}
