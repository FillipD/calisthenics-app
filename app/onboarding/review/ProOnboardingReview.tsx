"use client";
// app/onboarding/review/ProOnboardingReview.tsx
//
// Pro onboarding — assessment review step (client component).
// Auth and access checks are handled by the server wrapper (page.tsx).
//
// Data flow:
//   Previous step  →  writes ProOnboardingData to sessionStorage[PRO_ONBOARDING_KEY]
//   This component →  reads it on mount, runs assessProUser(), shows the skill tree
//   Confirm & Save →  POSTs to /api/onboarding/save (requires Clerk auth)
//   After save     →  clears sessionStorage, redirects to /skills
//
// If sessionStorage has no data (e.g. direct navigation), redirects to /onboarding/pro.

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { NODE_MAP, findBestSkillStep } from "@/lib/skillTree";
import type { SkillCategory } from "@/lib/skillTree";
import type { ProOnboardingData, ProOnboardingDataV2, ProgressStatus } from "@/types";
import { assessProUser } from "@/lib/proAssessment";
import { assessProUserV2 } from "@/lib/proAssessmentV2";
import type { ProAssessmentResult } from "@/lib/proAssessment";
import { buildTreeStateFromAssessment } from "@/lib/proTreeState";
import { PRO_ONBOARDING_KEY } from "@/lib/proOnboarding";
import SkillTabs from "@/components/skills/SkillTabs";
import SkillTree from "@/components/skills/SkillTree";
import { S } from "@/components/skills/tokens";

export default function ProOnboardingReview() {
  const router = useRouter();

  const [tab,         setTab]         = useState<SkillCategory>("pull");
  const [progress,    setProgress]    = useState<Record<string, ProgressStatus> | null>(null);
  const [goalNodeIds, setGoalNodeIds] = useState<string[]>([]);
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const [generatingPlan,  setGeneratingPlan]  = useState(false);
  const [planGenError,    setPlanGenError]    = useState<string | null>(null);
  const profileFieldsRef = useRef<{
    daysPerWeek?: number; equipment?: string[];
    emphasis?: string;    sessionLength?: string;
  } | null>(null);
  const initialized = useRef(false);

  // ── Read from sessionStorage on mount ─────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const raw = sessionStorage.getItem(PRO_ONBOARDING_KEY);
      if (!raw) {
        router.replace("/onboarding/pro");
        return;
      }
      const parsed = JSON.parse(raw);
      let result: ProAssessmentResult;
      if (parsed?.version === 2) {
        const v2 = parsed.data as ProOnboardingDataV2;
        result = assessProUserV2(v2);
        profileFieldsRef.current = {
          daysPerWeek:   v2.benchmarks.trainingDays,
          equipment:     v2.benchmarks.equipment,
          emphasis:      v2.benchmarks.emphasis,
          sessionLength: v2.benchmarks.sessionLength,
        };
      } else {
        const v1 = parsed as ProOnboardingData;
        result = assessProUser(v1);
        profileFieldsRef.current = {
          daysPerWeek:   v1.trainingDays,
          equipment:     v1.equipment,
          emphasis:      v1.emphasis,
          sessionLength: v1.sessionLength,
        };
      }
      const state  = buildTreeStateFromAssessment(result);
      setProgress(state.progress);
      setGoalNodeIds(result.goalNodeIds);
    } catch {
      router.replace("/onboarding/pro");
    }
  }, [router]);

  // ── Derive activeSkills reactively after manual corrections ───────────────
  const activeSkills = useMemo(() => {
    if (!progress) return {};
    const result: Record<string, string> = {};
    for (const goalId of goalNodeIds) {
      result[goalId] = findBestSkillStep(goalId, progress as Record<string, string>);
    }
    return result;
  }, [progress, goalNodeIds]);

  // ── Local node toggle (no API, local state only) ──────────────────────────
  // Click current → clear it.
  // Click other   → set as current, auto-complete ancestors, clear ancestor currents.
  const toggleNode = useCallback((nodeId: string) => {
    setProgress(prev => {
      if (!prev) return prev;
      const next: Record<string, ProgressStatus> = { ...prev };

      if (next[nodeId] === "current") {
        delete next[nodeId];
      } else {
        // Clear any ancestor "current" to avoid double-current chains
        let n = NODE_MAP.get(nodeId);
        while (n?.parentId) {
          if (next[n.parentId] === "current") delete next[n.parentId];
          n = NODE_MAP.get(n.parentId);
        }
        // Set as current + auto-complete ancestors
        next[nodeId] = "current";
        n = NODE_MAP.get(nodeId);
        while (n?.parentId) {
          next[n.parentId] = "completed";
          n = NODE_MAP.get(n.parentId);
        }
      }

      return next;
    });
  }, []);

  const noopGoalToggle = useCallback(() => {}, []);

  const handleRestart = useCallback(() => {
    try { sessionStorage.removeItem(PRO_ONBOARDING_KEY); } catch { /* ignore */ }
    router.push("/onboarding/pro");
  }, [router]);

  // ── Save to Supabase, then auto-generate first plan ──────────────────────
  const handleSave = useCallback(async () => {
    if (!progress) return;
    setSaving(true);
    setSaveError(null);

    const progressEntries = Object.entries(progress).map(
      ([nodeId, status]) => ({ nodeId, status }),
    );
    const goals = Object.entries(activeSkills).map(
      ([skillName, currentProgression]) => ({ skillName, currentProgression }),
    );

    let saved = false;
    try {
      const res  = await fetch("/api/onboarding/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          progress: progressEntries,
          goals,
          profileFields: profileFieldsRef.current ?? undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setSaveError("You need to be signed in to save. Please sign in and try again.");
        } else {
          setSaveError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      try { sessionStorage.removeItem(PRO_ONBOARDING_KEY); } catch { /* ignore */ }
      saved = true;
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }

    if (!saved) return;

    // Onboarding saved — now auto-generate the first plan.
    setGeneratingPlan(true);
    try {
      const planRes  = await fetch("/api/plan/generate", { method: "POST" });
      const planData = await planRes.json().catch(() => ({}));
      if (planRes.ok) {
        router.push("/dashboard");
      } else {
        setPlanGenError(
          typeof planData.error === "string"
            ? planData.error
            : "Plan generation failed. Please try again.",
        );
      }
    } catch {
      setPlanGenError("Network error. Please check your connection and try again.");
    } finally {
      setGeneratingPlan(false);
    }
  }, [progress, activeSkills, router]);

  // ── Retry plan generation (profile already saved) ────────────────────────
  const retryPlanGeneration = useCallback(async () => {
    setPlanGenError(null);
    setGeneratingPlan(true);
    try {
      const planRes  = await fetch("/api/plan/generate", { method: "POST" });
      const planData = await planRes.json().catch(() => ({}));
      if (planRes.ok) {
        router.push("/dashboard");
      } else {
        setPlanGenError(
          typeof planData.error === "string"
            ? planData.error
            : "Plan generation failed. Please try again.",
        );
      }
    } catch {
      setPlanGenError("Network error. Please check your connection and try again.");
    } finally {
      setGeneratingPlan(false);
    }
  }, [router]);

  // ── Loading state (waiting for sessionStorage read) ───────────────────────
  if (!progress) {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "0.875rem", color: S.muted }}>Loading…</p>
      </main>
    );
  }

  // ── Plan generation loading screen ────────────────────────────────────────
  if (generatingPlan) {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem" }}>
        <div style={{ textAlign: "center", maxWidth: "380px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            border: `3px solid ${S.border}`, borderTopColor: S.muscle,
            margin: "0 auto 1.5rem",
            animation: "spin 0.9s linear infinite",
          }} />
          <h1 style={{ margin: "0 0 0.6rem", fontSize: "1.6rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            Building your plan…
          </h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: S.muted, lineHeight: 1.65 }}>
            We're generating your first personalised weekly programme.
            This usually takes 15–25 seconds — hang tight.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  // ── Plan generation error screen ──────────────────────────────────────────
  if (planGenError) {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <h1 style={{ margin: "0 0 0.6rem", fontSize: "1.6rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            Plan generation failed
          </h1>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: S.rust, lineHeight: 1.6 }}>
            {planGenError}
          </p>
          <p style={{ margin: "0 0 2rem", fontSize: "0.82rem", color: S.muted, lineHeight: 1.6 }}>
            Your profile and skill tree were saved successfully.
            You can retry now or generate your plan later from the dashboard.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={retryPlanGeneration}
              style={{
                padding: "0.75rem 1.5rem",
                background: S.muscle, border: "none", borderRadius: "6px",
                fontSize: "0.875rem", fontWeight: 700, color: S.bg,
                cursor: "pointer",
              }}
            >
              Try again →
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                padding: "0.75rem 1.5rem",
                background: "none",
                border: `1px solid ${S.border}`,
                borderRadius: "6px",
                fontSize: "0.875rem", fontWeight: 600, color: S.muted,
                cursor: "pointer",
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  const completedCount = Object.values(progress).filter(s => s === "completed").length;
  const currentCount   = Object.values(progress).filter(s => s === "current").length;

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{
            margin: "0 0 0.35rem", fontSize: "2rem", fontWeight: 800,
            color: S.white, letterSpacing: "-0.03em",
          }}>
            Does this look right?
          </h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: S.muted, lineHeight: 1.55 }}>
            Based on your answers, we've placed you on the skill tree below.
            Look over each category and fix anything that seems off — then save to lock in your starting point.
          </p>
        </div>

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        <div style={{
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: "8px",
          display: "flex", flexWrap: "wrap", gap: "1rem",
        }}>
          {([
            { color: S.muscle,  label: "Where you are now",      note: "your active training step",        dim: false },
            { color: S.white,   label: "Already done",           note: "auto-completed from your answers", dim: false },
            { color: S.amber,   label: "Your goal",              note: "the skill you're working toward",  dim: false },
            { color: S.border,  label: "Not yet reachable",      note: "complete earlier steps first",     dim: true },
          ] as const).map(({ color, label, note, dim }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: dim ? 0.6 : 1 }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "3px", flexShrink: 0,
                background: color, border: dim ? `1px solid ${S.muted}` : "none",
              }} />
              <span style={{ fontSize: "0.75rem", color: S.mutedLight }}>
                {label}{" "}
                <span style={{ color: S.muted }}>— {note}</span>
              </span>
            </div>
          ))}
        </div>

        {/* ── Interaction hint ─────────────────────────────────────────────── */}
        <div style={{
          marginBottom: "1.5rem",
          padding: "0.6rem 1rem",
          background: "rgba(200,240,74,0.04)",
          border: "1px solid rgba(200,240,74,0.15)",
          borderRadius: "8px",
          display: "flex", alignItems: "flex-start", gap: "0.65rem",
        }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: S.muscle, flexShrink: 0, marginTop: "5px",
          }} />
          <p style={{ margin: 0, fontSize: "0.82rem", color: S.mutedLight, lineHeight: 1.55 }}>
            We placed{" "}
            <strong style={{ color: S.white }}>{completedCount}</strong>{" "}
            steps as done and{" "}
            <strong style={{ color: S.white }}>{currentCount}</strong>{" "}
            step{currentCount !== 1 ? "s" : ""} as in progress.{" "}
            <span style={{ color: S.muted }}>
              If something's wrong, tap that node to move your position there.
              Tap it again to clear it.
            </span>
          </p>
        </div>

        {/* ── Skill tree ───────────────────────────────────────────────────── */}
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: S.muted }}>
          Check all four tabs before saving — your goals may appear across different categories.
        </p>
        <SkillTabs tab={tab} activeSkills={activeSkills} onTabChange={setTab} />

        <SkillTree
          tab={tab}
          progress={progress}
          activeSkills={activeSkills}
          onNodeClick={toggleNode}
          onGoalToggle={noopGoalToggle}
        />

        {/* ── Save error ───────────────────────────────────────────────────── */}
        {saveError && (
          <div style={{
            marginTop: "1.5rem",
            padding: "0.65rem 1rem",
            background: "#1a0c0a",
            border: `1px solid ${S.rust}`,
            borderRadius: "8px",
          }}>
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.rust }}>{saveError}</p>
          </div>
        )}

        {/* ── Confirm button ───────────────────────────────────────────────── */}
        <div style={{ marginTop: "2rem", paddingBottom: "2.5rem" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: S.muted, lineHeight: 1.55 }}>
            Happy with this? Save to lock in your starting position.
            You can always update your progress later from the skills page.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "0.75rem 1.75rem",
                background: saving ? S.surface : S.muscle,
                border: "none", borderRadius: "6px",
                fontSize: "0.875rem", fontWeight: 700,
                color: saving ? S.muted : S.bg,
                cursor: saving ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving…" : "Save to my profile →"}
            </button>
            {!saving && (
              <button
                onClick={handleRestart}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: "0.8rem", color: S.muted,
                  cursor: "pointer", textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Change answers
              </button>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
