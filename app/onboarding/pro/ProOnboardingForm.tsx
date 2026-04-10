"use client";
// app/onboarding/pro/ProOnboardingForm.tsx
//
// Pro onboarding form — collects ProOnboardingData across 3–4 steps,
// writes it to sessionStorage, then redirects to /onboarding/review.
//
// Steps:
//   0 — Goals          (primaryGoal + secondaryGoals)
//   1 — Schedule       (equipment, trainingDays, sessionLength, emphasis)
//   2 — Base strength  (pullUpsMax, pushUpsMax, dipsMax)
//   3 — Assessment     (goal-specific questions, only shown when relevant)
//
// Auth and access checks are handled by the server wrapper (page.tsx).

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PRO_GOALS,
  PRO_ONBOARDING_KEY,
  getBaseProQuestions,
  getGoalSpecificQuestions,
  type ProQuestion,
} from "@/lib/proOnboarding";
import type { ProGoalId, ProOnboardingData, SessionLength, TrainingEmphasis } from "@/types";
import { S } from "@/components/skills/tokens";

// ─── Static question slices ───────────────────────────────────────────────────

const BASE_Qs     = getBaseProQuestions();
const SCHEDULE_Qs = BASE_Qs.slice(2, 6);  // equipment, trainingDays, sessionLength, emphasis
const STRENGTH_Qs = BASE_Qs.slice(6, 9);  // pullUpsMax, pushUpsMax, dipsMax

const STEP_TITLES = [
  "Choose your goals",
  "Schedule & setup",
  "Base strength",
  "Movement assessment",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Values = Record<string, unknown>;

// ─── Final data builder ───────────────────────────────────────────────────────

function buildData(v: Values): ProOnboardingData {
  const num = (k: string) => {
    const val = v[k];
    if (val === "" || val === undefined) return 0;
    return Number(val);
  };
  return {
    primaryGoal:           v.primaryGoal as ProGoalId,
    secondaryGoals:        (v.secondaryGoals as ProGoalId[]) ?? [],
    equipment:             (v.equipment as string[]) ?? [],
    trainingDays:          num("trainingDays") || 3,
    sessionLength:         (v.sessionLength as SessionLength) ?? "60",
    emphasis:              (v.emphasis as TrainingEmphasis) ?? "balanced",
    pullUpsMax:            num("pullUpsMax"),
    pushUpsMax:            num("pushUpsMax"),
    dipsMax:               num("dipsMax"),
    activeHangSeconds:     num("activeHangSeconds"),
    deadHangSeconds:       num("deadHangSeconds"),
    skinTheCat:            num("skinTheCat"),
    tuckFrontLeverSeconds: num("tuckFrontLeverSeconds"),
    oneLegFLSeconds:       num("oneLegFLSeconds"),
    straddleFLSeconds:     num("straddleFLSeconds"),
    tuckBackLeverSeconds:  num("tuckBackLeverSeconds"),
    advTuckBLSeconds:      num("advTuckBLSeconds"),
    oneLegBLSeconds:       num("oneLegBLSeconds"),
    wallHandstandSeconds:         num("wallHandstandSeconds"),
    freestandingHandstandSeconds: num("freestandingHandstandSeconds"),
    pikePushUpsMax:        num("pikePushUpsMax"),
    lSitSeconds:           num("lSitSeconds"),
    pistolSquatAssisted:   num("pistolSquatAssisted"),
    pistolSquatFull:       num("pistolSquatFull"),
    plancheLeanSeconds:    num("plancheLeanSeconds"),
    frogStandSeconds:      num("frogStandSeconds"),
    tuckPlancheSeconds:    num("tuckPlancheSeconds"),
    shrimpSquatAssisted:   num("shrimpSquatAssisted"),
    shrimpSquatFull:       num("shrimpSquatFull"),
    falseGripHangSeconds:  num("falseGripHangSeconds"),
    falseGripPullUpsMax:   num("falseGripPullUpsMax"),
    ringDipsMax:           num("ringDipsMax"),
    ringSupportHoldSeconds: num("ringSupportHoldSeconds"),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(step: number, v: Values): string | null {
  if (step === 0) {
    if (!v.primaryGoal) return "Choose a primary goal to continue.";
  }
  if (step === 1) {
    const days = Number(v.trainingDays);
    if (v.trainingDays === "" || v.trainingDays === undefined || days < 1 || days > 6)
      return "Enter how many days per week you train (1–6).";
    if (!v.sessionLength) return "Choose a session length.";
    if (!v.emphasis)      return "Choose what you want to prioritise.";
  }
  if (step === 2) {
    if (v.pullUpsMax === "" || v.pullUpsMax === undefined)
      return "Enter your pull-up max — use 0 if you can't do one yet.";
    if (v.pushUpsMax === "" || v.pushUpsMax === undefined)
      return "Enter your push-up max.";
    if (v.dipsMax === "" || v.dipsMax === undefined)
      return "Enter your dips max — use 0 if you can't do one yet.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProOnboardingForm({ resetMode }: { resetMode?: boolean }) {
  const router = useRouter();
  const [step,   setStep]   = useState(0);
  const [values, setValues] = useState<Values>({ secondaryGoals: [], equipment: [] });
  const [error,  setError]  = useState<string | null>(null);

  // In reset mode, wipe any stale sessionStorage from a previous incomplete attempt
  useEffect(() => {
    if (resetMode) {
      try { sessionStorage.removeItem(PRO_ONBOARDING_KEY); } catch { /* ignore */ }
    }
  }, [resetMode]);

  const primaryGoal    = values.primaryGoal as ProGoalId | undefined;
  const secondaryGoals = (values.secondaryGoals as ProGoalId[]) ?? [];
  const allGoals       = primaryGoal ? [primaryGoal, ...secondaryGoals] : [];

  const specificQs = getGoalSpecificQuestions(allGoals as ProGoalId[]);
  const totalSteps = specificQs.length > 0 ? 4 : 3;
  const isLastStep = step === totalSteps - 1;

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

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleNext = () => {
    const err = validate(step, values);
    if (err) { setError(err); return; }
    setError(null);
    if (isLastStep) {
      const data = buildData(values);
      try { sessionStorage.setItem(PRO_ONBOARDING_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      router.push("/onboarding/review");
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => { setError(null); setStep(s => s - 1); };

  // ── Input renderers ──────────────────────────────────────────────────────────

  const renderGoalCards = (key: "primaryGoal" | "secondaryGoals") => {
    const isMulti = key === "secondaryGoals";
    const choices = isMulti ? PRO_GOALS.filter(g => g.id !== primaryGoal) : PRO_GOALS;

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "0.6rem" }}>
        {choices.map(g => {
          const active = isMulti ? secondaryGoals.includes(g.id) : primaryGoal === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                if (isMulti) {
                  toggleMulti(key, g.id);
                } else {
                  setValues(prev => ({
                    ...prev,
                    primaryGoal:    g.id,
                    secondaryGoals: ((prev.secondaryGoals as ProGoalId[]) ?? []).filter(s => s !== g.id),
                  }));
                  setError(null);
                }
              }}
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
    );
  };

  const renderQ = (q: ProQuestion) => {
    if (q.inputType === "number") {
      const val = values[q.id];
      return (
        <div key={q.id} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          {q.helpText && (
            <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", color: S.muted }}>{q.helpText}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={q.min ?? 0}
              max={q.max}
              value={val === undefined ? "" : String(val)}
              onChange={e => set(q.id, e.target.value === "" ? "" : Number(e.target.value))}
              style={{
                width: "88px", padding: "0.5rem 0.75rem",
                background: S.surfaceHigh, border: `1px solid ${S.border}`,
                borderRadius: "6px", color: S.white, fontSize: "1rem", outline: "none",
              }}
            />
            {q.unit && <span style={{ fontSize: "0.8rem", color: S.muted }}>{q.unit}</span>}
          </div>
        </div>
      );
    }

    if (q.inputType === "select") {
      const val = values[q.id];
      return (
        <div key={q.id} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {q.choices?.map(c => {
              const active = val === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => set(q.id, c.value)}
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
      const arr = (values[q.id] as string[]) ?? [];
      return (
        <div key={q.id} style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.875rem", fontWeight: 600, color: S.white }}>
            {q.label}
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {q.choices?.map(c => {
              const checked = arr.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => toggleMulti(q.id, c.value)}
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

  const renderStepContent = () => {
    if (step === 0) {
      return (
        <>
          <div style={{ marginBottom: "2rem" }}>
            <p style={{ margin: "0 0 0.65rem", fontSize: "0.72rem", fontWeight: 600, color: S.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Primary goal — required
            </p>
            {renderGoalCards("primaryGoal")}
          </div>
          {primaryGoal && (
            <div>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.72rem", fontWeight: 600, color: S.mutedLight, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Additional goals — optional
              </p>
              <p style={{ margin: "0 0 0.65rem", fontSize: "0.72rem", color: S.muted }}>
                You can add more after onboarding too.
              </p>
              {renderGoalCards("secondaryGoals")}
            </div>
          )}
        </>
      );
    }

    if (step === 1) return <>{SCHEDULE_Qs.map(q => renderQ(q))}</>;
    if (step === 2) return <>{STRENGTH_Qs.map(q => renderQ(q))}</>;

    if (step === 3) {
      return (
        <>
          <p style={{ margin: "0 0 1.5rem", fontSize: "0.82rem", color: S.muted, lineHeight: 1.55 }}>
            These questions are specific to your selected goals. Enter 0 if you haven&apos;t trained a movement yet — the assessment is conservative and won&apos;t overclaim your level.
          </p>
          {specificQs.map(q => renderQ(q))}
        </>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.72rem", color: S.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Step {step + 1} of {totalSteps}
          </p>
          <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.75rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            {STEP_TITLES[step]}
          </h1>
          <div style={{ height: "3px", background: S.border, borderRadius: "2px" }}>
            <div style={{
              height: "100%",
              width: `${((step + 1) / totalSteps) * 100}%`,
              background: S.muscle, borderRadius: "2px",
              transition: "width 0.25s",
            }} />
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.5rem" }}>
          {renderStepContent()}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginBottom: "1rem", padding: "0.6rem 0.9rem",
            background: "rgba(224,90,43,0.08)", border: `1px solid ${S.rust}`,
            borderRadius: "6px",
          }}>
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.rust }}>{error}</p>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", paddingBottom: "2rem" }}>
          {step > 0 && (
            <button
              onClick={handleBack}
              style={{
                padding: "0.6rem 1.2rem",
                background: "transparent", border: `1px solid ${S.border}`,
                borderRadius: "6px", color: S.muted, cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              padding: "0.65rem 1.5rem",
              background: S.muscle, border: "none",
              borderRadius: "6px", color: S.bg,
              cursor: "pointer", fontSize: "0.875rem", fontWeight: 700,
            }}
          >
            {isLastStep ? "Continue to review →" : "Next →"}
          </button>
        </div>

      </div>
    </main>
  );
}
