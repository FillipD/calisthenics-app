"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { NODE_MAP, TAB_SKILL_GOALS, findNextSkillStep } from "@/lib/skillTree";
import type { SkillCategory } from "@/lib/skillTree";
import type { ProgressStatus } from "@/types";
import SkillTabs from "@/components/skills/SkillTabs";
import SkillTree from "@/components/skills/SkillTree";
import { S } from "@/components/skills/tokens";

interface Props {
  initialSkills:   Record<string, string>;
  initialProgress: Record<string, ProgressStatus>;
}

const LEGEND = [
  { bg: S.muscle,  border: `1px solid ${S.muscle}`,            color: S.bg,      label: "Current",     icon: null, opacity: undefined, glow: false },
  { bg: S.white,   border: `1px solid ${S.white}`,             color: "#0f0f0e", label: "Completed",   icon: "✓",  opacity: undefined, glow: false },
  { bg: S.surface, border: `1px solid ${S.border}`,            color: S.white,   label: "Not started", icon: null, opacity: undefined, glow: false },
  { bg: S.surface, border: `1px solid ${S.border}`,            color: S.muted,   label: "Locked",      icon: null, opacity: 0.45,      glow: false },
  { bg: S.surface, border: `1.5px solid rgba(200,240,74,0.4)`, color: S.muscle,  label: "Skill goal",  icon: "★",  opacity: undefined, glow: false },
  { bg: S.amber,   border: `2px solid ${S.amber}`,             color: "#fff",    label: "Active goal", icon: "★",  opacity: undefined, glow: true  },
];

export default function SkillTreePage({ initialSkills, initialProgress }: Props) {
  const [tab,          setTab]          = useState<SkillCategory>("pull");
  const [progress,     setProgress]     = useState<Record<string, ProgressStatus>>(initialProgress);
  const [activeSkills, setActiveSkills] = useState<Record<string, string>>(initialSkills);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Toggle a node as current. If already current → clear it (smart ancestor walk).
  // Otherwise → set as current, auto-complete ancestors, clear any descendant currents.
  // Locked nodes are filtered upstream in SkillTree.
  const toggleCurrent = useCallback(async (nodeId: string) => {
    if (saving) return;
    setSaving(true); setError(null);

    if (progress[nodeId] === "current") {
      // Deselect: server computes exactly which ancestor completions to also remove
      const res = await fetch("/api/progress", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      const data = await res.json();
      if (res.ok) {
        const cleared: string[] = data.cleared ?? [];
        setProgress(prev => {
          const next = { ...prev };
          for (const id of cleared) delete next[id];
          return next;
        });
      } else {
        setError(data.error ?? "Something went wrong");
      }
    } else {
      // Set as current — server auto-completes ancestors and clears descendant currents
      const res = await fetch("/api/progress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, status: "current" }),
      });
      const data = await res.json();
      if (res.ok) {
        const cleared: string[] = data.cleared ?? [];
        setProgress(prev => {
          const next: Record<string, ProgressStatus> = { ...prev, [nodeId]: "current" };
          // Auto-complete all ancestors toward root
          let node = NODE_MAP.get(nodeId);
          while (node?.parentId) { next[node.parentId] = "completed"; node = NODE_MAP.get(node.parentId); }
          // Remove any descendant "current" nodes the server cleared
          for (const id of cleared) delete next[id];
          return next;
        });
      } else {
        setError(data.error ?? "Something went wrong");
      }
    }

    setSaving(false);
  }, [progress, saving]);

  const setSkillGoal = useCallback(async (nodeId: string) => {
    const node = NODE_MAP.get(nodeId);
    if (!node) return;
    setSaving(true); setError(null);
    const res = await fetch("/api/skills", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillName: nodeId, category: node.category }),
    });
    const data = await res.json();
    if (res.ok) {
      setActiveSkills(prev => ({ ...prev, [nodeId]: data.currentProgression }));
    } else {
      setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }, []);

  const advanceSkillGoal = useCallback(async (goalId: string) => {
    if (saving) return;
    setSaving(true); setError(null);
    const res = await fetch("/api/skills", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillName: goalId }),
    });
    const data = await res.json();
    if (res.ok) {
      setActiveSkills(prev => ({ ...prev, [goalId]: data.nextProgression }));
    } else {
      setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }, [saving]);

  const removeSkillGoal = useCallback(async (nodeId: string) => {
    setSaving(true); setError(null);
    const res = await fetch("/api/skills", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillName: nodeId }),
    });
    if (res.ok) {
      setActiveSkills(prev => { const next = { ...prev }; delete next[nodeId]; return next; });
    } else {
      const data = await res.json(); setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }, []);

  const activeGoalId   = TAB_SKILL_GOALS[tab].find(id => id in activeSkills) ?? null;
  const activeGoalNode = activeGoalId ? NODE_MAP.get(activeGoalId) : null;

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        <Link href="/dashboard" style={{ fontSize: "0.8rem", color: S.muted, textDecoration: "none", letterSpacing: "0.04em", display: "inline-block", marginBottom: "1.75rem" }}>
          ← Back to dashboard
        </Link>

        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>Skill Tree</h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: S.muted }}>Tap a node to set it as your current position. Tap again to clear.</p>
        </div>

        <SkillTabs tab={tab} activeSkills={activeSkills} onTabChange={(t) => { setTab(t); setError(null); }} />

        <p style={{ margin: "0 0 1.25rem", fontSize: "0.72rem", color: S.muted, lineHeight: 1.5, maxWidth: "600px" }}>
          All exercises can be performed on a bar, rings, parallettes, or floor — choose based on what you have available. Rings and parallettes generally increase difficulty and range of motion.
        </p>

        {activeGoalNode && activeGoalId && (() => {
          const currentProgressionId   = activeSkills[activeGoalId];
          const currentProgressionName = NODE_MAP.get(currentProgressionId)?.name ?? currentProgressionId;
          const hasNextStep            = !!findNextSkillStep(currentProgressionId);
          return (
            <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "rgba(224,123,42,0.08)", border: `1px solid ${S.amber}`, borderRadius: "8px", boxShadow: "0 0 12px rgba(224,123,42,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: S.amber, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: S.amber, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Goal: {activeGoalNode.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: S.mutedLight }}>
                    Current step: {currentProgressionName}
                  </p>
                </div>
                {hasNextStep && (
                  <button
                    onClick={() => advanceSkillGoal(activeGoalId)}
                    disabled={saving}
                    style={{ background: S.amber, border: "none", borderRadius: "5px", padding: "4px 10px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.72rem", color: "#fff", fontWeight: 700, whiteSpace: "nowrap", opacity: saving ? 0.6 : 1 }}
                  >
                    Mark done →
                  </button>
                )}
                <button
                  onClick={() => removeSkillGoal(activeGoalId)}
                  disabled={saving}
                  style={{ background: "transparent", border: `1px solid ${S.amber}`, borderRadius: "5px", padding: "4px 10px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.72rem", color: S.amber, fontWeight: 600 }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })()}

        {error && (
          <div style={{ marginBottom: "1.25rem", padding: "0.65rem 1rem", background: "#1a0c0a", border: `1px solid ${S.rust}`, borderRadius: "8px" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.rust }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {LEGEND.map(({ bg, border, color, label, icon, opacity, glow }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: bg, border, flexShrink: 0, opacity, boxShadow: glow ? "0 0 6px rgba(224,123,42,0.5)" : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {icon && <span style={{ fontSize: "0.5rem", color, fontWeight: 800 }}>{icon}</span>}
              </div>
              <span style={{ fontSize: "0.7rem", color: S.muted }}>{label}</span>
            </div>
          ))}
        </div>

        <SkillTree
          tab={tab}
          progress={progress}
          activeSkills={activeSkills}
          onNodeClick={toggleCurrent}
          onGoalToggle={(id) => id in activeSkills ? removeSkillGoal(id) : setSkillGoal(id)}
        />
      </div>
    </main>
  );
}
