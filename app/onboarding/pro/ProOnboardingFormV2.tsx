"use client";
// app/onboarding/pro/ProOnboardingFormV2.tsx
//
// Pro onboarding form — v2.
//
// Steps:
//   0 — Goals      (GoalSelectionV2: 1 primary + constrained secondaries)
//   1 — Schedule   (equipment, trainingDays, sessionLength, emphasis)
//   2 — Benchmarks (9 global questions: reps, yes/no, milestone selects)
//   3 — Refinement (1–2 questions per selected goal; skipped if none needed)
//
// Writes { version: 2, data: ProOnboardingDataV2 } to sessionStorage[PRO_ONBOARDING_KEY].
// The review page reads the version flag and calls assessProUserV2() accordingly.
// V1 form (ProOnboardingForm.tsx) remains untouched for reference.

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  ProGoalId,
  SessionLength,
  TrainingEmphasis,
  LSitLevel,
  FrontLeverLevel,
  BackLeverLevel,
  HandstandLevel,
  PlancheLevel,
  RingMULevel,
  PistolSquatLevel,
  ShrimpSquatLevel,
  ProOnboardingDataV2,
} from "@/types";
import { PRO_ONBOARDING_KEY } from "@/lib/proOnboarding";
import {
  SCHEDULE_QUESTIONS,
  BENCHMARK_QUESTIONS,
  getGoalRefinementQuestions,
  type BenchmarkQuestion,
  type RefinementQuestion,
} from "@/lib/proOnboardingV2";
import GoalSelectionV2 from "./GoalSelectionV2";
import { S } from "@/components/skills/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type Values = Record<string, unknown>;

// ─── Data builder ─────────────────────────────────────────────────────────────

function buildDataV2(
  primaryGoal:    ProGoalId,
  secondaryGoals: ProGoalId[],
  v: Values,
): ProOnboardingDataV2 {
  const num  = (k: string) => { const x = v[k]; return x === "" || x === undefined ? 0 : Number(x); };
  const bool = (k: string) => v[k] === true;

  return {
    primaryGoal,
    secondaryGoals,
    benchmarks: {
      equipment:           (v.equipment as string[]) ?? [],
      trainingDays:        num("trainingDays") || 3,
      sessionLength:       (v.sessionLength as SessionLength) ?? "60",
      emphasis:            (v.emphasis as TrainingEmphasis) ?? "balanced",
      pullUpsMax:          num("pullUpsMax"),
      pushUpsMax:          num("pushUpsMax"),
      dipsMax:             num("dipsMax"),
      pikePushUpsMax:      num("pikePushUpsMax"),
      canSkinTheCat:       bool("canSkinTheCat"),
      wallHandstandAny:    bool("wallHandstandAny"),
      pistolSquatAny:      bool("pistolSquatAny"),
      hangingLegRaisesMax: num("hangingLegRaisesMax"),
      lSitLevel:           (v.lSitLevel as LSitLevel) ?? "none",
    },
    refinement: {
      ...(v.frontLeverLevel  !== undefined && { frontLeverLevel:  v.frontLeverLevel  as FrontLeverLevel }),
      ...(v.backLeverLevel   !== undefined && { backLeverLevel:   v.backLeverLevel   as BackLeverLevel }),
      ...(v.handstandLevel   !== undefined && { handstandLevel:   v.handstandLevel   as HandstandLevel }),
      ...(v.plancheLevel     !== undefined && { plancheLevel:     v.plancheLevel     as PlancheLevel }),
      ...(v.ringMULevel      !== undefined && { ringMULevel:      v.ringMULevel      as RingMULevel }),
      ...(v.ringDipsMax      !== undefined && { ringDipsMax:      num("ringDipsMax") }),
      ...(v.pistolSquatLevel !== undefined && { pistolSquatLevel: v.pistolSquatLevel as PistolSquatLevel }),
      ...(v.shrimpSquatLevel !== undefined && { shrimpSquatLevel: v.shrimpSquatLevel as ShrimpSquatLevel }),
    },
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(
  step: number,
  primaryGoal: ProGoalId | undefined,
  v: Values,
  refinementQs: (BenchmarkQuestion | RefinementQuestion)[],
): string | null {
  if (step === 0) {
    if (!primaryGoal) return "Choose a primary goal to continue.";
  }
  if (step === 1) {
    const days = Number(v.trainingDays);
    if (!v.trainingDays || days < 1 || days > 6)
      return "Enter how many days per week you train (1–6).";
    if (!v.sessionLength) return "Choose a session length.";
    if (!v.emphasis)      return "Choose what you want to prioritise.";
  }
  if (step === 2) {
    if (v.pullUpsMax    === "" || v.pullUpsMax    === undefined) return "Enter your pull-up max — use 0 if you can't do one yet.";
    if (v.pushUpsMax    === "" || v.pushUpsMax    === undefined) return "Enter your push-up max.";
    if (v.dipsMax       === "" || v.dipsMax       === undefined) return "Enter your dips max — use 0 if not yet.";
    if (v.pikePushUpsMax === "" || v.pikePushUpsMax === undefined) return "Enter your pike push-up max — use 0 if not yet.";
    if (v.canSkinTheCat   === undefined) return "Answer the skin-the-cat question.";
    if (v.wallHandstandAny === undefined) return "Answer the wall handstand question.";
    if (v.pistolSquatAny   === undefined) return "Answer the pistol squat question.";
    if (v.hangingLegRaisesMax === "" || v.hangingLegRaisesMax === undefined) return "Enter your hanging leg raise max — use 0 if not yet.";
    if (!v.lSitLevel) return "Choose your L-sit level.";
  }
  if (step === 3) {
    for (const q of refinementQs) {
      if (q.inputType === "select" && !v[q.id]) {
        return `Please answer: "${q.label}"`;
      }
    }
  }
  return null;
}

// ─── Step titles & descriptions ───────────────────────────────────────────────

const STEP_TITLES = [
  "Choose your goals",
  "Schedule & preferences",
  "Fitness benchmarks",
  "Skill level check",
];

const STEP_DESCRIPTIONS = [
  "Pick the skill you most want to achieve. You can add supporting goals from other categories after.",
  "Tell us how often you train and how long your sessions are so we can build the right volume.",
  "These 9 questions let us place you accurately on the skill tree — no stopwatch needed.",
  "", // filled dynamically
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProOnboardingFormV2({ resetMode }: { resetMode?: boolean }) {
  const router = useRouter();
  const [step,   setStep]   = useState(0);
  const [values, setValues] = useState<Values>({ equipment: [] });
  const [error,  setError]  = useState<string | null>(null);

  // In reset mode, wipe any stale sessionStorage from a previous attempt
  useEffect(() => {
    if (resetMode) {
      try { sessionStorage.removeItem(PRO_ONBOARDING_KEY); } catch { /* ignore */ }
    }
  }, [resetMode]);

  const primaryGoal    = values.primaryGoal as ProGoalId | undefined;
  const secondaryGoals = (values.secondaryGoals as ProGoalId[]) ?? [];
  const allGoals       = primaryGoal ? [primaryGoal, ...secondaryGoals] : [];

  const refinementQs = getGoalRefinementQuestions(allGoals);
  const totalSteps   = refinementQs.length > 0 ? 4 : 3;
  const isLastStep   = step === totalSteps - 1;

  // ── State helpers ────────────────────────────────────────────────────────────

  const set = useCallback((key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setError(null);
  }, []);

  const toggleMulti = useCallback((key: string, val: string) => {
    setValues(prev => {
      const arr = (prev[key] as string[]) ?? [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
    setError(null);
  }, []);

  const handleGoalChange = useCallback((primary: ProGoalId | undefined, secondaries: ProGoalId[]) => {
    setValues(prev => ({ ...prev, primaryGoal: primary, secondaryGoals: secondaries }));
    setError(null);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const scrollTop = () => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ } };

  const handleNext = () => {
    const err = validate(step, primaryGoal, values, refinementQs);
    if (err) { setError(err); return; }
    setError(null);
    if (isLastStep) {
      const data = buildDataV2(primaryGoal!, secondaryGoals, values);
      try { sessionStorage.setItem(PRO_ONBOARDING_KEY, JSON.stringify({ version: 2, data })); } catch { /* ignore */ }
      router.push("/onboarding/review");
    } else {
      setStep(s => s + 1);
      scrollTop();
    }
  };

  const handleBack = () => { setError(null); setStep(s => s - 1); scrollTop(); };

  // ── Question renderer ────────────────────────────────────────────────────────

  const renderQ = (q: BenchmarkQuestion | RefinementQuestion) => {
    const key = q.id as string;

    if (q.inputType === "number") {
      const val = values[key];
      return (
        <div key={key} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          {q.helpText && <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", color: S.muted }}>{q.helpText}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={q.min ?? 0}
              placeholder="0"
              value={val === undefined ? "" : String(val)}
              onChange={e => set(key, e.target.value === "" ? "" : Number(e.target.value))}
              style={{
                width: "96px", padding: "0.55rem 0.75rem",
                background: S.surfaceHigh, border: `1px solid ${S.border}`,
                borderRadius: "6px", color: S.white, fontSize: "1rem", outline: "none",
              }}
            />
            {"unit" in q && q.unit && <span style={{ fontSize: "0.8rem", color: S.muted }}>{q.unit}</span>}
          </div>
        </div>
      );
    }

    if (q.inputType === "boolean") {
      const val = values[key];
      return (
        <div key={key} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          {q.helpText && <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", color: S.muted }}>{q.helpText}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {([true, false] as const).map(opt => {
              const active = val === opt;
              return (
                <button
                  key={String(opt)}
                  onClick={() => set(key, opt)}
                  style={{
                    padding: "0.65rem 2rem",
                    background: active ? "rgba(200,240,74,0.08)" : S.surface,
                    border: `1.5px solid ${active ? S.muscle : S.border}`,
                    borderRadius: "6px", cursor: "pointer",
                    fontSize: "0.875rem", fontWeight: active ? 700 : 400,
                    color: active ? S.muscle : S.white,
                    transition: "border-color 0.1s",
                  }}
                >
                  {opt ? "Yes" : "No"}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (q.inputType === "select") {
      const val = values[key];
      return (
        <div key={key} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          {q.helpText && <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", color: S.muted }}>{q.helpText}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {q.choices?.map(c => {
              const active = val === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => set(key, c.value)}
                  style={{
                    textAlign: "left", padding: "0.6rem 0.9rem",
                    background: active ? "rgba(200,240,74,0.08)" : S.surface,
                    border: `1.5px solid ${active ? S.muscle : S.border}`,
                    borderRadius: "6px", cursor: "pointer",
                    fontSize: "0.82rem", color: active ? S.muscle : S.white,
                    transition: "border-color 0.1s",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (q.inputType === "multiselect") {
      const arr = (values[key] as string[]) ?? [];
      return (
        <div key={key} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {q.choices?.map(c => {
              const checked = arr.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => toggleMulti(key, c.value)}
                  style={{
                    textAlign: "left", padding: "0.6rem 0.9rem",
                    background: checked ? "rgba(200,240,74,0.06)" : S.surface,
                    border: `1.5px solid ${checked ? S.muscle : S.border}`,
                    borderRadius: "6px", cursor: "pointer",
                    fontSize: "0.82rem", color: checked ? S.muscle : S.white,
                    display: "flex", alignItems: "center", gap: "0.6rem",
                    transition: "border-color 0.1s",
                  }}
                >
                  <span style={{
                    width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
                    background: checked ? S.muscle : "transparent",
                    border: `1.5px solid ${checked ? S.muscle : S.muted}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <span style={{ fontSize: "9px", color: S.bg, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  // ── Step content ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    if (step === 0) {
      return (
        <GoalSelectionV2
          primaryGoal={primaryGoal}
          secondaryGoals={secondaryGoals}
          onChange={handleGoalChange}
        />
      );
    }
    if (step === 1) {
      return <>{SCHEDULE_QUESTIONS.map(renderQ)}</>;
    }
    if (step === 2) {
      return <>{BENCHMARK_QUESTIONS.map(renderQ)}</>;
    }
    if (step === 3) {
      return <>{refinementQs.map(q => renderQ(q as unknown as BenchmarkQuestion))}</>;
    }
    return null;
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  // Dynamic description for the refinement step
  const stepDescription = step === 3
    ? `${refinementQs.length} quick question${refinementQs.length !== 1 ? "s" : ""} to fine-tune your starting position for ${allGoals.length > 1 ? "your selected goals" : "your goal"}.`
    : STEP_DESCRIPTIONS[step];

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>

        {/* Progress bar */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.72rem", color: S.muted }}>Step {step + 1} of {totalSteps}</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "20px", height: "3px", borderRadius: "2px",
                    background: i <= step ? S.muscle : S.surface,
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ height: "3px", background: S.surface, borderRadius: "2px" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: S.muscle, borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Step header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.75rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            {STEP_TITLES[step]}
          </h1>
          {stepDescription && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.muted, lineHeight: 1.55 }}>
              {stepDescription}
            </p>
          )}
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: "1rem", padding: "0.65rem 1rem", background: "#1a0c0a", border: `1px solid ${S.rust}`, borderRadius: "8px" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.rust }}>{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem", paddingBottom: "2rem" }}>
          {step > 0 && (
            <button
              onClick={handleBack}
              style={{
                padding: "0.75rem 1.25rem",
                background: "transparent", border: `1px solid ${S.border}`,
                borderRadius: "6px", cursor: "pointer",
                fontSize: "0.875rem", color: S.muted, flexShrink: 0,
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: "0.75rem 1.5rem",
              background: S.muscle, border: "none",
              borderRadius: "6px", cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 700, color: S.bg,
            }}
          >
            {isLastStep ? "Review my assessment →" : "Continue →"}
          </button>
        </div>

      </div>
    </main>
  );
}
