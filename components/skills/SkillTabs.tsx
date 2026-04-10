"use client";

import { CATEGORIES, TAB_SKILL_GOALS } from "@/lib/skillTree";
import type { SkillCategory } from "@/lib/skillTree";
import { S } from "./tokens";

interface SkillTabsProps {
  tab:          SkillCategory;
  activeSkills: Record<string, string>;
  onTabChange:  (tab: SkillCategory) => void;
}

export default function SkillTabs({ tab, activeSkills, onTabChange }: SkillTabsProps) {
  return (
    <div style={{ display: "flex", gap: "4px", borderBottom: `1px solid ${S.border}`, marginBottom: "1.5rem" }}>
      {CATEGORIES.map(({ id, label }) => {
        const active  = tab === id;
        const hasGoal = TAB_SKILL_GOALS[id].some(sid => sid in activeSkills);
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              padding: "0.5rem 1.1rem", background: "transparent", border: "none",
              borderBottom: active ? `2px solid ${S.muscle}` : "2px solid transparent",
              cursor: "pointer", fontSize: "0.85rem",
              fontWeight: active ? 700 : 400,
              color: active ? S.white : S.muted,
              marginBottom: "-1px",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {label}
            {hasGoal && (
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: S.muscle, display: "inline-block" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
