"use client";
// app/onboarding/pro/GoalSelectionV2.tsx
//
// Goal selection component for v2 pro onboarding.
//
// Selection rules (enforced in UI and data layer):
//   - Exactly 1 primary goal (required)
//   - Up to 1 secondary goal per remaining category
//   - No secondary from the same category as the primary
//
// After picking a primary, secondary options appear grouped by category.
// Each category section behaves like a radio group: picking a different goal
// in the same category swaps it; picking the same goal deselects it.
// The primary's category is hidden from secondary selection entirely.

import { useCallback } from "react";
import type { ProGoalId } from "@/types";
import { PRO_GOALS } from "@/lib/proOnboarding";
import {
  getGoalCategory,
  getSecondaryGoalsByCategory,
  sanitizeSecondaryGoals,
  toggleSecondaryGoal,
  CATEGORY_LABELS,
  type GoalCategory,
} from "@/lib/proOnboardingV2";
import { S } from "@/components/skills/tokens";

interface Props {
  primaryGoal:    ProGoalId | undefined;
  secondaryGoals: ProGoalId[];
  onChange: (primary: ProGoalId | undefined, secondaries: ProGoalId[]) => void;
}

const CATEGORY_ORDER: GoalCategory[] = ["pull", "push", "legs", "core"];

const CATEGORY_SUBTITLES: Record<GoalCategory, string> = {
  pull: "Hanging & pulling skills",
  push: "Pressing & pushing skills",
  legs: "Single-leg & squat skills",
  core: "Core & balance skills",
};

export default function GoalSelectionV2({ primaryGoal, secondaryGoals, onChange }: Props) {

  const handlePrimaryClick = useCallback((goalId: ProGoalId) => {
    if (primaryGoal === goalId) {
      // Deselect primary — also clears secondaries
      onChange(undefined, []);
      return;
    }
    // When primary changes, sanitize secondaries to drop same-category selections
    const sanitized = primaryGoal
      ? sanitizeSecondaryGoals(goalId, secondaryGoals)
      : [];
    onChange(goalId, sanitized);
  }, [primaryGoal, secondaryGoals, onChange]);

  const handleSecondaryClick = useCallback((goalId: ProGoalId) => {
    if (!primaryGoal) return;
    onChange(primaryGoal, toggleSecondaryGoal(primaryGoal, secondaryGoals, goalId));
  }, [primaryGoal, secondaryGoals, onChange]);

  const primaryCategory = primaryGoal ? getGoalCategory(primaryGoal) : undefined;
  const secondaryGroups = primaryGoal ? getSecondaryGoalsByCategory(primaryGoal) : [];

  // How many secondary goals are selected per category
  const selectedPerCategory = new Map<GoalCategory, ProGoalId>();
  for (const id of secondaryGoals) {
    const cat = getGoalCategory(id);
    selectedPerCategory.set(cat, id);
  }

  return (
    <div>
      {/* ── Primary goal ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{
          margin: "0 0 0.25rem",
          fontSize: "0.72rem", fontWeight: 700,
          color: S.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase",
        }}>
          Primary goal — required
        </p>
        <p style={{ margin: "0 0 0.9rem", fontSize: "0.82rem", color: S.muted, lineHeight: 1.5 }}>
          Your main focus. Your plan will be built around this first. Choose one.
        </p>

        {/* Group primary goals by category for clarity */}
        {CATEGORY_ORDER.map(cat => {
          const goals = PRO_GOALS.filter(g => g.category === cat);
          return (
            <div key={cat} style={{ marginBottom: "0.75rem" }}>
              <div style={{ marginBottom: "0.4rem" }}>
                <p style={{
                  margin: "0 0 0.1rem",
                  fontSize: "0.65rem", fontWeight: 700,
                  color: S.mutedLight, letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  {CATEGORY_LABELS[cat]}
                </p>
                <p style={{ margin: 0, fontSize: "0.65rem", color: S.muted }}>
                  {CATEGORY_SUBTITLES[cat]}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.5rem" }}>
                {goals.map(g => {
                  const active = primaryGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handlePrimaryClick(g.id as ProGoalId)}
                      style={{
                        textAlign: "left", padding: "0.85rem 1rem",
                        background: active ? "rgba(200,240,74,0.08)" : S.surface,
                        border: `1.5px solid ${active ? S.muscle : S.border}`,
                        borderRadius: "8px", cursor: "pointer",
                        transition: "border-color 0.1s, background 0.1s",
                      }}
                    >
                      <p style={{ margin: "0 0 3px", fontSize: "0.85rem", fontWeight: 700, color: active ? S.muscle : S.white }}>
                        {g.label}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: S.muted, lineHeight: 1.4 }}>
                        {g.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Secondary goals ─────────────────────────────────────────────────── */}
      {primaryGoal && (
        <div>
          <p style={{
            margin: "0 0 0.25rem",
            fontSize: "0.72rem", fontWeight: 700,
            color: S.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase",
          }}>
            Supporting goals — optional
          </p>
          <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: S.muted, lineHeight: 1.5 }}>
            Pick up to one goal from each remaining category. Your plan will prioritise the primary goal
            and weave these in as supporting work.{" "}
            <span style={{ color: S.mutedLight }}>
              {CATEGORY_LABELS[primaryCategory!]} goals are hidden — your primary already covers that category.
            </span>
          </p>

          {secondaryGroups.map(({ category, label, goals }) => {
            const selectedInCategory = selectedPerCategory.get(category);
            return (
              <div key={category} style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                  <p style={{
                    margin: 0,
                    fontSize: "0.65rem", fontWeight: 600,
                    color: S.muted, letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    {label}
                  </p>
                  <span style={{ fontSize: "0.65rem", color: S.muted }}>
                    — pick 0 or 1
                  </span>
                  {selectedInCategory && (
                    <span style={{
                      marginLeft: "auto",
                      fontSize: "0.65rem", color: S.muscle, fontWeight: 600,
                    }}>
                      ✓ selected
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.5rem" }}>
                  {goals.map(g => {
                    const active = secondaryGoals.includes(g.id as ProGoalId);
                    return (
                      <button
                        key={g.id}
                        onClick={() => handleSecondaryClick(g.id as ProGoalId)}
                        style={{
                          textAlign: "left", padding: "0.85rem 1rem",
                          background: active ? "rgba(200,240,74,0.06)" : S.surface,
                          border: `1.5px solid ${active ? S.muscle : S.border}`,
                          borderRadius: "8px", cursor: "pointer",
                          transition: "border-color 0.1s, background 0.1s",
                        }}
                      >
                        <p style={{ margin: "0 0 3px", fontSize: "0.85rem", fontWeight: 700, color: active ? S.muscle : S.white }}>
                          {g.label}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: S.muted, lineHeight: 1.4 }}>
                          {g.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
