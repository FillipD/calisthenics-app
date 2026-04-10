// lib/skillLayout.ts
// Tree layout algorithm for the skill tree canvas.

import { NODES } from "@/lib/skillTree";
import type { SkillCategory } from "@/lib/skillTree";
import type { NodePos } from "@/types";

const NODE_W = 140;
const NODE_H = 44;
const H_GAP  = 24;
const V_STEP = NODE_H + 60;
const CELL_W = NODE_W + H_GAP;

export function buildRegularChildren(category: SkillCategory): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of NODES) {
    if (node.category !== category || !node.parentId || node.isAlternative) continue;
    if (!map.has(node.parentId)) map.set(node.parentId, []);
    map.get(node.parentId)!.push(node.id);
  }
  return map;
}

export function buildAllChildren(category: SkillCategory): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of NODES) {
    if (node.category !== category || !node.parentId) continue;
    if (!map.has(node.parentId)) map.set(node.parentId, []);
    map.get(node.parentId)!.push(node.id);
  }
  return map;
}

function subtreeSpan(id: string, children: Map<string, string[]>): number {
  const kids = children.get(id) ?? [];
  if (kids.length === 0) return 1;
  return kids.reduce((s, k) => s + subtreeSpan(k, children), 0);
}

export function computeLayout(category: SkillCategory): Map<string, NodePos> {
  const positions       = new Map<string, NodePos>();
  const regularChildren = buildRegularChildren(category);
  const roots           = NODES.filter(n => n.category === category && n.parentId === null);

  function place(id: string, depth: number, slotStart: number) {
    const span = subtreeSpan(id, regularChildren);
    positions.set(id, {
      x: (slotStart + span / 2) * CELL_W - NODE_W / 2,
      y: depth * V_STEP,
    });
    let s = slotStart;
    for (const kid of regularChildren.get(id) ?? []) {
      place(kid, depth + 1, s);
      s += subtreeSpan(kid, regularChildren);
    }
  }

  let slotOffset = 0;
  for (const root of roots) {
    place(root.id, 0, slotOffset);
    slotOffset += subtreeSpan(root.id, regularChildren) + 1;
  }

  const altsByParent = new Map<string, string[]>();
  for (const node of NODES) {
    if (node.category !== category || !node.isAlternative || !node.parentId) continue;
    if (!altsByParent.has(node.parentId)) altsByParent.set(node.parentId, []);
    altsByParent.get(node.parentId)!.push(node.id);
  }
  for (const [parentId, alts] of altsByParent) {
    const pPos = positions.get(parentId);
    if (!pPos) continue;
    alts.forEach((altId, i) => {
      positions.set(altId, { x: pPos.x + NODE_W + H_GAP * 2, y: pPos.y + i * (NODE_H + 10) });
    });
  }

  return positions;
}

// Re-export layout constants needed by the canvas renderer
export { NODE_W, NODE_H, V_STEP };
