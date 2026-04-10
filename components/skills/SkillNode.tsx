"use client";

import type { TreeNode } from "@/lib/skillTree";
import type { VisualState } from "@/types";
import { S } from "./tokens";

interface SkillNodeProps {
  node:            TreeNode;
  visualState:     VisualState;
  isActiveGoal:    boolean;
  isTerminalGoal:  boolean;
  tabHasOtherGoal: boolean;
  onClick:         (() => void) | undefined;
  onGoalToggle:    () => void;
}

// Flat-top hexagon matching dagre 90×80 node dimensions
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export default function SkillNode({
  node, visualState, isActiveGoal, isTerminalGoal, tabHasOtherGoal, onClick, onGoalToggle,
}: SkillNodeProps) {
  const isAlt = !!node.isAlternative;

  // Fill and text color per visual state
  let bg      = S.surface;
  let color   = S.white;
  let opacity = 1;

  if (visualState === "current") {
    bg = S.muscle; color = S.bg;
  } else if (visualState === "completed") {
    bg = S.white; color = "#0f0f0e";
  } else if (visualState === "locked") {
    color = S.muted; opacity = 0.5;
  } else if (isAlt) {
    color = S.muted;
  }

  // Terminal goal overrides
  if (isTerminalGoal && isActiveGoal) {
    bg = S.amber; color = "#fff"; opacity = 1;
  }

  // drop-shadow is applied AFTER clip-path, so it follows the hexagon shape.
  // Applied to the hexagon div (not the wrapper) so badges/pill don't inherit it.
  let filter: string | undefined;
  if (isActiveGoal && isTerminalGoal) {
    filter = "drop-shadow(0 0 8px rgba(224,123,42,0.6)) drop-shadow(0 0 3px rgba(224,123,42,0.35))";
  } else if (isTerminalGoal && visualState !== "current" && visualState !== "completed") {
    filter = "drop-shadow(0 0 2px rgba(200,240,74,0.55)) drop-shadow(0 0 1px rgba(200,240,74,0.3))";
  }

  const canSetGoal = !tabHasOtherGoal || isActiveGoal;
  const pillLabel  = isActiveGoal ? "✓ Goal set" : "Set as goal";
  const pillColor  = isActiveGoal ? "#fff" : tabHasOtherGoal ? S.muted : S.muscle;
  const pillBg     = isActiveGoal ? "rgba(0,0,0,0.2)" : "rgba(200,240,74,0.1)";
  const pillBorder = isActiveGoal ? `1px solid rgba(255,255,255,0.25)` : `1px solid rgba(200,240,74,0.3)`;

  const isClickable = !isTerminalGoal && visualState !== "locked" && !!onClick;

  // Star/checkmark inline with name so they stay in the safe center zone of the hexagon
  const prefix = isTerminalGoal
    ? <span style={{ fontSize: "8px", color: isActiveGoal ? "rgba(255,255,255,0.7)" : S.muscle }}>★ </span>
    : visualState === "completed"
    ? <span style={{ fontSize: "8px", fontWeight: 800, color: "#0f0f0e" }}>✓ </span>
    : null;

  return (
    // Outer wrapper: layout context for absolutely-positioned badges / pill below
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "visible" }}>

      {/* ── Hexagon ─────────────────────────────────────────────── */}
      <div
        onClick={isClickable ? onClick : undefined}
        title={node.name}
        style={{
          width: "100%", height: "100%",
          clipPath: HEX_CLIP,
          filter,
          background: bg,
          opacity,
          cursor: isClickable ? "pointer" : "default",
          boxSizing: "border-box",
          // Vertical padding clears the tapered top/bottom corners (25% of 80px = 20px)
          padding: "20px 12px",
          display: "flex", alignItems: "center", justifyContent: "center",
          userSelect: "none",
          transition: "opacity 0.15s",
        }}
      >
        <p style={{
          margin: 0,
          fontSize: "9px",
          fontWeight: visualState === "current" || isTerminalGoal ? 700 : 500,
          color,
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          textAlign: "center",
          maxWidth: "100%",
        }}>
          {prefix}{node.name}
        </p>
      </div>

      {/* ── Equipment badges — below hexagon, regular nodes only ── */}
      {!isTerminalGoal && node.equipment && node.equipment.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: "50%",
          transform: "translateX(-50%)",
          display: "flex", flexWrap: "wrap", gap: "2px",
          justifyContent: "center",
        }}>
          {node.equipment.map(tag => (
            <span key={tag} style={{
              fontSize: "6px", padding: "1px 3px", borderRadius: "2px",
              background: S.surfaceHigh, color: S.muted,
              border: "1px solid transparent", whiteSpace: "nowrap",
            }}>{tag}</span>
          ))}
        </div>
      )}

      {/* ── Goal pill — below hexagon, terminal nodes only ── */}
      {isTerminalGoal && (
        <div
          onClick={(e) => { e.stopPropagation(); if (canSetGoal) onGoalToggle(); }}
          style={{
            position: "absolute", top: "calc(100% + 5px)", left: "50%",
            transform: "translateX(-50%)",
            fontSize: "7px", fontWeight: 700,
            letterSpacing: "0.05em", textTransform: "uppercase",
            color: pillColor, background: pillBg, border: pillBorder,
            borderRadius: "3px", padding: "2px 7px",
            cursor: canSetGoal ? "pointer" : "not-allowed",
            opacity: !canSetGoal ? 0.45 : 1,
            transition: "opacity 0.15s", whiteSpace: "nowrap",
          }}
        >
          {pillLabel}
        </div>
      )}
    </div>
  );
}
