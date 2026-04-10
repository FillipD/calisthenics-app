"use client";

import { useMemo } from "react";
import ReactFlow, {
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "reactflow";
import dagre from "@dagrejs/dagre";
import "reactflow/dist/style.css";

import { NODES, NODE_MAP, TERMINAL_GOAL_SET, TAB_SKILL_GOALS } from "@/lib/skillTree";
import type { SkillCategory, TreeNode } from "@/lib/skillTree";
import type { ProgressStatus, VisualState } from "@/types";
import { buildAllChildren } from "@/lib/skillLayout";
import SkillNode from "./SkillNode";
import { S } from "./tokens";

// ─── Node dimensions (hexagon 90×80, matching dagre layout) ──────────────────
const NODE_W = 90;
const NODE_H = 80;

// ─── Custom React Flow node ───────────────────────────────────────────────────
// Must live outside SkillTree component so React Flow's nodeTypes reference
// stays stable across renders.

type SkillNodeData = {
  treeNode:        TreeNode;
  visualState:     VisualState;
  isActiveGoal:    boolean;
  isTerminalGoal:  boolean;
  tabHasOtherGoal: boolean;
  onClick:         (() => void) | undefined;
  onGoalToggle:    () => void;
};

// Keep handles invisible but at natural size (6px default) so React Flow can
// read their DOM position for precise edge endpoint calculation.
const INVISIBLE_HANDLE: React.CSSProperties = {
  opacity: 0,
  border: "none",
  background: "transparent",
  pointerEvents: "none",
};

function SkillFlowNode({ data }: NodeProps<SkillNodeData>) {
  return (
    <>
      <Handle type="target" position={Position.Top}    style={INVISIBLE_HANDLE} />
      <SkillNode
        node={data.treeNode}
        visualState={data.visualState}
        isActiveGoal={data.isActiveGoal}
        isTerminalGoal={data.isTerminalGoal}
        tabHasOtherGoal={data.tabHasOtherGoal}
        onClick={data.onClick}
        onGoalToggle={data.onGoalToggle}
      />
      <Handle type="source" position={Position.Bottom} style={INVISIBLE_HANDLE} />
    </>
  );
}

const NODE_TYPES = { skillNode: SkillFlowNode };

// ─── Dagre layout ─────────────────────────────────────────────────────────────
function buildDagrePositions(category: SkillCategory): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60 });

  const catNodes = NODES.filter(n => n.category === category);

  catNodes.forEach(node => {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  });

  catNodes.filter(n => n.parentId).forEach(node => {
    g.setEdge(node.parentId!, node.id);
  });

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  catNodes.forEach(node => {
    const { x, y } = g.node(node.id);
    // Dagre returns centre; React Flow wants top-left corner
    positions.set(node.id, { x: x - NODE_W / 2, y: y - NODE_H / 2 });
  });

  return positions;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SkillTreeProps {
  tab:          SkillCategory;
  progress:     Record<string, ProgressStatus>;
  activeSkills: Record<string, string>;
  onNodeClick:  (nodeId: string) => void;
  onGoalToggle: (nodeId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SkillTree({ tab, progress, activeSkills, onNodeClick, onGoalToggle }: SkillTreeProps) {
  // Compute which nodes are locked (descendants of any "current" node in this tab)
  const lockedNodes = useMemo(() => {
    const allChildren = buildAllChildren(tab);
    const locked = new Set<string>();
    for (const [nodeId, status] of Object.entries(progress)) {
      if (status !== "current") continue;
      if (NODE_MAP.get(nodeId)?.category !== tab) continue;
      const queue = [nodeId];
      while (queue.length) {
        const id = queue.shift()!;
        for (const kid of allChildren.get(id) ?? []) { locked.add(kid); queue.push(kid); }
      }
    }
    return locked;
  }, [progress, tab]);

  function getVisualState(nodeId: string): VisualState {
    if (progress[nodeId] === "current")   return "current";
    if (progress[nodeId] === "completed") return "completed";
    if (lockedNodes.has(nodeId))          return "locked";
    return "reachable";
  }

  // Layout positions — only recomputed when the tab changes
  const positions = useMemo(() => buildDagrePositions(tab), [tab]);

  // React Flow nodes and edges
  const { rfNodes, rfEdges } = useMemo(() => {
    const catNodes = NODES.filter(n => n.category === tab);

    const rfNodes: Node<SkillNodeData>[] = catNodes.map(node => {
      const id          = node.id;
      const pos         = positions.get(id) ?? { x: 0, y: 0 };
      const visualState = getVisualState(id);
      const isGoal      = TERMINAL_GOAL_SET.has(id);

      const data: SkillNodeData = {
        treeNode:        node,
        visualState,
        isActiveGoal:    id in activeSkills,
        isTerminalGoal:  isGoal,
        tabHasOtherGoal: TAB_SKILL_GOALS[tab].some(sid => sid in activeSkills && sid !== id),
        onClick:         visualState === "locked" ? undefined : () => onNodeClick(id),
        onGoalToggle:    () => onGoalToggle(id),
      };

      return {
        id,
        type: "skillNode",
        position: pos,
        // sourcePosition/targetPosition tell RF which side handles live on,
        // ensuring edges route from bottom of parent to top of child.
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data,
        style: { width: NODE_W, height: NODE_H },
        draggable:    false,
        selectable:   false,
        focusable:    false,
        connectable:  false,
      };
    });

    const rfEdges: Edge[] = catNodes
      .filter(n => n.parentId)
      .map(node => ({
        id:     `e-${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type:   "straight",
        style:  {
          stroke: S.line,
          strokeWidth: 1,
          ...(node.isAlternative ? { strokeDasharray: "5,4" } : {}),
        },
        focusable:   false,
        selectable:  false,
      }));

    return { rfNodes, rfEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, positions, progress, activeSkills, lockedNodes, onNodeClick, onGoalToggle]);

  return (
    <div style={{ width: "100%", height: "calc(100dvh - 360px)", minHeight: 480 }}>
      <ReactFlow
        key={tab}                    // remounts + re-fits when switching tabs
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={() => {}}     // controlled mode; positions never user-modified
        onEdgesChange={() => {}}
        onNodeClick={() => {}}       // required: without this RF sets pointer-events:none on all nodes
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll
        zoomOnPinch
        panOnDrag
        panOnScroll={false}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: S.bg }}
      />
    </div>
  );
}
