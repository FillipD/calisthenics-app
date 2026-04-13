// lib/skillTeaser.ts
// Builds data for a large, blurred skill tree preview on the free result page.
// Uses actual node names from skillTree.ts to feel authentic.

import { NODES, NODE_MAP } from "./skillTree"
import type { SkillCategory } from "./skillTree"

export interface PreviewNode {
  id: string
  name: string
  col: number   // grid column
  row: number   // grid row
  state: "past" | "current" | "future" | "goal"
}

export interface PreviewEdge {
  fromId: string
  toId: string
  lit: boolean
}

export interface PreviewTreeData {
  nodes: PreviewNode[]
  edges: PreviewEdge[]
  cols: number
  rows: number
  category: SkillCategory
  label: string
}

// ── Curated tree layouts ────────────────────────────────────────────────────
// These show enough nodes to feel dense and real, with branching structure.
// We render ALL of these but blur most — only a small cluster near the user
// is visible.

const PULL_LAYOUT: { id: string; col: number; row: number }[] = [
  // Row 0: root
  { id: "dead-hang",         col: 3, row: 0 },
  // Row 1
  { id: "active-hang",       col: 3, row: 1 },
  // Row 2: first branch
  { id: "pullup-negative",   col: 1, row: 2 },
  { id: "row-bent-legs",     col: 3, row: 2 },
  { id: "chinup-negative",   col: 5, row: 2 },
  // Row 3
  { id: "banded-pullup",     col: 1, row: 3 },
  { id: "row-straight-legs", col: 3, row: 3 },
  { id: "banded-chinup",     col: 5, row: 3 },
  // Row 4
  { id: "pullup",            col: 1, row: 4 },
  { id: "row-elevated-legs", col: 3, row: 4 },
  { id: "chinup",            col: 5, row: 4 },
  // Row 5: many branches split
  { id: "explosive-pullup",  col: 0, row: 5 },
  { id: "archer-pullup",     col: 2, row: 5 },
  { id: "arch-hang",         col: 3, row: 5 },
  { id: "ring-row",          col: 4, row: 5 },
  { id: "weighted-chinup",   col: 6, row: 5 },
  // Row 6
  { id: "high-pullup",       col: 0, row: 6 },
  { id: "typewriter-pullup", col: 2, row: 6 },
  { id: "tuck-fl",           col: 3, row: 6 },
  { id: "tuck-bl",           col: 4, row: 6 },
  // Row 7
  { id: "negative-mu",       col: 0, row: 7 },
  { id: "one-leg-fl",        col: 3, row: 7 },
  { id: "adv-tuck-bl",       col: 4, row: 7 },
  // Row 8: goals
  { id: "kipping-mu",        col: 0, row: 8 },
  { id: "straddle-fl",       col: 3, row: 8 },
  { id: "one-leg-bl",        col: 4, row: 8 },
  // Row 9: terminal goals
  { id: "strict-mu",         col: 0, row: 9 },
  { id: "full-fl",           col: 3, row: 9 },
  { id: "full-bl",           col: 4, row: 9 },
]

const PULL_EDGES: [string, string][] = [
  ["dead-hang", "active-hang"],
  ["active-hang", "pullup-negative"],
  ["active-hang", "row-bent-legs"],
  ["active-hang", "chinup-negative"],
  ["pullup-negative", "banded-pullup"],
  ["row-bent-legs", "row-straight-legs"],
  ["chinup-negative", "banded-chinup"],
  ["banded-pullup", "pullup"],
  ["row-straight-legs", "row-elevated-legs"],
  ["banded-chinup", "chinup"],
  ["pullup", "explosive-pullup"],
  ["pullup", "archer-pullup"],
  ["row-elevated-legs", "arch-hang"],
  ["row-elevated-legs", "ring-row"],
  ["chinup", "weighted-chinup"],
  ["explosive-pullup", "high-pullup"],
  ["archer-pullup", "typewriter-pullup"],
  ["arch-hang", "tuck-fl"],
  ["ring-row", "tuck-bl"],
  ["high-pullup", "negative-mu"],
  ["tuck-fl", "one-leg-fl"],
  ["tuck-bl", "adv-tuck-bl"],
  ["negative-mu", "kipping-mu"],
  ["one-leg-fl", "straddle-fl"],
  ["adv-tuck-bl", "one-leg-bl"],
  ["kipping-mu", "strict-mu"],
  ["straddle-fl", "full-fl"],
  ["one-leg-bl", "full-bl"],
]

const PUSH_LAYOUT: { id: string; col: number; row: number }[] = [
  // Row 0: roots
  { id: "incline-knee-pu",   col: 1, row: 0 },
  { id: "bench-dip",         col: 3, row: 0 },
  { id: "wall-plank",        col: 5, row: 0 },
  // Row 1
  { id: "knee-pu",           col: 1, row: 1 },
  { id: "dip-negative",      col: 3, row: 1 },
  { id: "kick-to-wall-hs",   col: 5, row: 1 },
  // Row 2
  { id: "standard-pu",       col: 1, row: 2 },
  { id: "banded-dip",        col: 3, row: 2 },
  { id: "chest-to-wall-hs",  col: 5, row: 2 },
  // Row 3
  { id: "explosive-pu",      col: 0, row: 3 },
  { id: "diamond-pu",        col: 1, row: 3 },
  { id: "dip",               col: 3, row: 3 },
  { id: "hs-kick-balance",   col: 5, row: 3 },
  // Row 4
  { id: "archer-pu",         col: 0, row: 4 },
  { id: "decline-pu",        col: 1, row: 4 },
  { id: "ring-support-hold", col: 3, row: 4 },
  { id: "weighted-dip",      col: 4, row: 4 },
  { id: "freestanding-hs",   col: 5, row: 4 },
  // Row 5
  { id: "planche-lean",      col: 0, row: 5 },
  { id: "ring-pushup",       col: 2, row: 5 },
  { id: "ring-dip",          col: 3, row: 5 },
  { id: "press-handstand",   col: 5, row: 5 },
  // Row 6
  { id: "frog-stand",        col: 0, row: 6 },
  // Row 7
  { id: "tuck-planche",      col: 0, row: 7 },
  // Row 8
  { id: "full-planche",      col: 0, row: 8 },
]

const PUSH_EDGES: [string, string][] = [
  ["incline-knee-pu", "knee-pu"],
  ["bench-dip", "dip-negative"],
  ["wall-plank", "kick-to-wall-hs"],
  ["knee-pu", "standard-pu"],
  ["dip-negative", "banded-dip"],
  ["kick-to-wall-hs", "chest-to-wall-hs"],
  ["standard-pu", "explosive-pu"],
  ["standard-pu", "diamond-pu"],
  ["banded-dip", "dip"],
  ["chest-to-wall-hs", "hs-kick-balance"],
  ["explosive-pu", "archer-pu"],
  ["diamond-pu", "decline-pu"],
  ["dip", "ring-support-hold"],
  ["dip", "weighted-dip"],
  ["hs-kick-balance", "freestanding-hs"],
  ["archer-pu", "planche-lean"],
  ["ring-support-hold", "ring-pushup"],
  ["ring-support-hold", "ring-dip"],
  ["freestanding-hs", "press-handstand"],
  ["planche-lean", "frog-stand"],
  ["frog-stand", "tuck-planche"],
  ["tuck-planche", "full-planche"],
]

// ── Estimate user position ──────────────────────────────────────────────────

function estimateDifficulty(pullUps: number, pushUps: number, dips: number): number {
  const pull = pullUps === 0 ? 1 : pullUps <= 3 ? 2 : pullUps <= 7 ? 3 : pullUps <= 14 ? 5 : 6
  const push = pushUps <= 5 ? 1 : pushUps <= 15 ? 2 : pushUps <= 29 ? 3 : 4
  const dip  = dips === 0 ? 1 : dips <= 3 ? 2 : dips <= 14 ? 3 : 5
  return Math.max(pull, push, dip)
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getPreviewTree(
  category: "pull" | "push",
  pullUps: number,
  pushUps: number,
  dips: number,
): PreviewTreeData {
  const layout = category === "pull" ? PULL_LAYOUT : PUSH_LAYOUT
  const edgeDefs = category === "pull" ? PULL_EDGES : PUSH_EDGES
  const userDiff = estimateDifficulty(pullUps, pushUps, dips)

  const terminalGoals = new Set(
    category === "pull"
      ? ["strict-mu", "full-fl", "full-bl", "one-arm-pullup", "ring-mu"]
      : ["freestanding-hs", "hspu", "full-planche"]
  )

  // Find current node (highest difficulty node at or below user level)
  let currentId: string | null = null
  let maxDiffBelow = 0
  for (const item of layout) {
    const node = NODE_MAP.get(item.id)
    if (!node) continue
    const diff = node.difficulty ?? 1
    if (diff <= userDiff && diff > maxDiffBelow) {
      maxDiffBelow = diff
      currentId = item.id
    }
  }
  if (!currentId) currentId = layout[0].id

  const currentDiff = NODE_MAP.get(currentId)?.difficulty ?? 1

  const nodes: PreviewNode[] = layout.map(item => {
    const node = NODE_MAP.get(item.id)
    const diff = node?.difficulty ?? 1

    let state: PreviewNode["state"] = "future"
    if (item.id === currentId) state = "current"
    else if (diff <= currentDiff) state = "past"
    else if (terminalGoals.has(item.id)) state = "goal"

    return {
      id: item.id,
      name: node?.name ?? item.id,
      col: item.col,
      row: item.row,
      state,
    }
  })

  const edges: PreviewEdge[] = edgeDefs.map(([fromId, toId]) => {
    const fromDiff = NODE_MAP.get(fromId)?.difficulty ?? 1
    return { fromId, toId, lit: fromDiff <= currentDiff }
  })

  const maxCol = Math.max(...layout.map(n => n.col))
  const maxRow = Math.max(...layout.map(n => n.row))

  return {
    nodes,
    edges,
    cols: maxCol + 1,
    rows: maxRow + 1,
    category,
    label: category === "pull" ? "Pull" : "Push",
  }
}
