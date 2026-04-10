"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TrainingDay, Exercise } from "@/types";
import { evaluateWorkout, type WorkoutEval, type EvalInput } from "@/lib/workoutEval";

const S = {
  bg:          "#0f0f0e",
  surface:     "#1a1a18",
  surfaceHigh: "#222220",
  border:      "#2e2e2b",
  white:       "#f5f0e8",
  muted:       "#7a7a6e",
  mutedLight:  "#a0a090",
  muscle:      "#c8f04a",
  rust:        "#e05a2b",
};

// ─── Prescription adjuster ────────────────────────────────────────────────────
// Session-only helper: shifts the displayed reps/hold string up (easier) or
// down (harder) after an exercise swap. Operates on two formats:
//   Rep range  "N–M"   e.g. "6–8", "3–5"  → shift ±2
//   Hold range "N–Ms"  e.g. "5–10s"        → shift ±step (2 / 5 / 10 by magnitude)
// Also handles hyphens in place of em dashes, and "N–M sec" / "N–M s".
// Anything else — "Max", "Max sec", single numbers — falls back unchanged.

function adjustPrescription(reps: string, direction: "easier" | "harder"): string {
  // Rep range: "6–8" or "6-8"
  const repMatch = reps.match(/^(\d+)[–\-](\d+)$/);
  if (repMatch) {
    const lo   = parseInt(repMatch[1], 10);
    const hi   = parseInt(repMatch[2], 10);
    const step = 2;
    if (direction === "easier") {
      return `${lo + step}–${hi + step}`;
    } else {
      const newLo = Math.max(1, lo - step);
      const newHi = Math.max(newLo, hi - step);
      return `${newLo}–${newHi}`;
    }
  }

  // Hold range: "5–10s", "5-10s", "5–10 sec", "5–10sec"
  const holdMatch = reps.match(/^(\d+)[–\-](\d+)\s*s(?:ec)?$/i);
  if (holdMatch) {
    const lo   = parseInt(holdMatch[1], 10);
    const hi   = parseInt(holdMatch[2], 10);
    // Step scales with magnitude so adjustments feel proportional
    const step = lo <= 3 ? 2 : lo <= 10 ? 5 : 10;
    // Preserve the original suffix form (e.g. "s" vs " sec")
    const suffix = reps.replace(/^\d+[–\-]\d+\s*/, "");
    if (direction === "easier") {
      return `${lo + step}–${hi + step}${suffix}`;
    } else {
      const newLo = Math.max(1, lo - step);
      const newHi = Math.max(newLo, hi - step);
      return `${newLo}–${newHi}${suffix}`;
    }
  }

  // "Max", "Max sec", single values, or unrecognised — return unchanged
  return reps;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type Status = "idle" | "active" | "done";

// setInputs: keyed by "<section>:<index>", value is array of reps per set
type SetInputs = Record<string, (number | "")[]>;

interface Props {
  day: TrainingDay;
}

export default function WorkoutClient({ day }: Props) {
  const router = useRouter();
  const [status,       setStatus]       = useState<Status>("idle");
  const [elapsed,      setElapsed]      = useState(0);
  const [setInputs,    setSetInputs]    = useState<SetInputs>({});
  // swaps: keyed by exercise key ("skill:0", "main:2").
  // Stores both the replacement name and the adjusted prescription for that session.
  const [swaps, setSwaps] = useState<Record<string, { name: string; reps: string }>>({});
  // clearedKeys: tracks cards whose reps were non-empty when a swap happened.
  // The notice is dismissed as soon as the user starts entering new reps.
  const [clearedKeys, setClearedKeys] = useState<Record<string, boolean>>({});
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [workoutEval,  setWorkoutEval]  = useState<WorkoutEval | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exercises = day.exercises ?? [];
  const skillWork = day.skillWork  ?? [];

  // Initialise input arrays when workout starts
  function initInputs() {
    const init: SetInputs = {};
    skillWork.forEach((ex, i) => { init[`skill:${i}`] = Array(ex.sets).fill(""); });
    exercises.forEach((ex, i) => { init[`main:${i}`]  = Array(ex.sets).fill(""); });
    setSetInputs(init);
  }

  function startWorkout() {
    initInputs();
    setStatus("active");
    intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function updateRep(key: string, setIdx: number, value: string) {
    const n = value === "" ? "" : Math.max(0, parseInt(value, 10) || 0);
    setSetInputs(prev => {
      const arr = [...(prev[key] ?? [])];
      arr[setIdx] = n;
      return { ...prev, [key]: arr };
    });
    // Dismiss the "reps cleared" notice once the user starts entering new values
    if (clearedKeys[key]) setClearedKeys(prev => ({ ...prev, [key]: false }));
  }

  function handleSwap(key: string, newName: string, newReps: string) {
    // Check whether this card had any reps entered before the swap
    const hadReps = (setInputs[key] ?? []).some(v => v !== "" && Number(v) > 0);
    // Clear the inputs so old reps don't carry over to the new exercise name
    setSetInputs(prev => ({ ...prev, [key]: Array((prev[key] ?? []).length).fill("") }));
    if (hadReps) setClearedKeys(prev => ({ ...prev, [key]: true }));
    setSwaps(prev => ({ ...prev, [key]: { name: newName, reps: newReps } }));
  }

  async function finishWorkout() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSaving(true);
    setSaveError(null);

    const allExercises = [
      ...skillWork.map((ex, i) => ({ ex, key: `skill:${i}`, isSkillWork: true })),
      ...exercises.map((ex, i) => ({ ex, key: `main:${i}`,  isSkillWork: false })),
    ];

    const payload = allExercises.map(({ ex, key }) => {
      const repsArr       = (setInputs[key] ?? []).map(v => (v === "" ? 0 : Number(v)));
      const setsCompleted = repsArr.filter(r => r > 0).length;
      const repsCompleted = repsArr.reduce((a, b) => a + b, 0);
      const setsData      = repsArr.map((reps, idx) => ({ set: idx + 1, reps }));
      return {
        name: swaps[key]?.name ?? ex.name,
        setsCompleted,
        repsCompleted,
        sets_data: setsData,
      };
    });

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: day.day, exercises: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Failed to save. Try again.");
        setSaving(false);
        return;
      }
    } catch {
      setSaveError("Failed to save. Check your connection.");
      setSaving(false);
      return;
    }

    // Evaluate performance against prescribed targets.
    // Runs after a successful save so the result is never shown for unsaved sessions.
    const evalInputs: EvalInput[] = allExercises.map(({ ex, key, isSkillWork }) => {
      const swappedName = swaps[key]?.name;
      let swapDirection: EvalInput["swapDirection"] = null;
      if (swappedName && ex.swapOptions) {
        if (ex.swapOptions.easier.includes(swappedName))       swapDirection = "easier";
        else if (ex.swapOptions.harder.includes(swappedName))  swapDirection = "harder";
        else                                                    swapDirection = "alternative";
      }
      return {
        name:           swappedName ?? ex.name,
        prescribedSets: ex.sets,
        prescribedReps: ex.reps,        // always the original prescription
        loggedSets:     setInputs[key] ?? [],
        swapDirection,
        isSkillWork,
      };
    });

    setWorkoutEval(evaluateWorkout(evalInputs));
    setSaving(false);
    setStatus("done");
  }

  const totalExercises = exercises.length + skillWork.length;
  const completedCount = Object.values(setInputs).filter(arr =>
    (arr as (number | "")[]).some(v => v !== "" && Number(v) > 0)
  ).length;

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (status === "done") {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem 5rem" }}>
        <div style={{ maxWidth: "480px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "2rem", lineHeight: 1 }}>✓</p>
            <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.6rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
              Workout done
            </h1>
            <p style={{ margin: "0 0 0.2rem", fontSize: "0.9rem", color: S.mutedLight }}>{day.focus}</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: S.muted }}>
              {formatTime(elapsed)} · {completedCount}/{totalExercises} exercises logged
            </p>
          </div>

          {/* Performance summary */}
          {workoutEval && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "12px", overflow: "hidden", marginBottom: "1rem" }}>

              <div style={{ padding: "0.875rem 1.125rem 0.5rem" }}>
                <p style={{ margin: 0, fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
                  Performance
                </p>
              </div>

              <div style={{ padding: "0 1.125rem 0.875rem" }}>
                {workoutEval.exercises.map((ev, i) => (
                  <EvalRow key={i} ev={ev} last={i === workoutEval.exercises.length - 1} />
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${S.border}`, padding: "0.875rem 1.125rem" }}>
                <p style={{ margin: "0 0 2px", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: S.muted }}>
                  Takeaway
                </p>
                <p style={{ margin: 0, fontSize: "0.82rem", color: S.mutedLight, lineHeight: 1.6, fontStyle: "italic" }}>
                  {workoutEval.takeaway}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            style={{
              width: "100%",
              background: S.muscle,
              color: "#0f0f0e",
              border: "none",
              borderRadius: "10px",
              padding: "1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            Back to dashboard
          </button>

        </div>
      </main>
    );
  }

  // ── Idle screen ──────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, padding: "0 0 5rem" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1.25rem 1.25rem 0.5rem" }}>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ background: "transparent", border: "none", color: S.muted, fontSize: "1.2rem", cursor: "pointer", padding: "4px 2px", lineHeight: 1 }}
            >
              ←
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
                {day.day}
              </p>
              <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: S.white, letterSpacing: "-0.02em" }}>
                {day.focus}
              </p>
            </div>
          </div>

          {/* Exercise preview */}
          <div style={{ padding: "1rem 1.25rem 1.5rem" }}>
            {skillWork.length > 0 && (
              <ExercisePreviewSection label="Skill work" labelColor={S.muscle} exercises={skillWork} />
            )}
            <ExercisePreviewSection label="Main work" labelColor={S.muted} exercises={exercises} />
          </div>

          {/* Start button */}
          <div style={{ padding: "0 1.25rem" }}>
            <button
              onClick={startWorkout}
              style={{
                width: "100%",
                background: S.muscle,
                color: "#0f0f0e",
                border: "none",
                borderRadius: "10px",
                padding: "1.1rem",
                fontSize: "1rem",
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              Start Workout
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Active screen ────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "0 0 6rem" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: S.bg,
          borderBottom: `1px solid ${S.border}`,
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "1rem 1.25rem",
        }}>
          <button
            onClick={() => {
              if (confirm("End workout without saving?")) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                router.push("/dashboard");
              }
            }}
            style={{ background: "transparent", border: "none", color: S.muted, fontSize: "1.2rem", cursor: "pointer", padding: "4px 2px", lineHeight: 1, flexShrink: 0 }}
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: S.white, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {day.focus}
            </p>
          </div>
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.85rem", fontWeight: 600, color: S.muscle, letterSpacing: "0.02em", flexShrink: 0 }}>
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Skill work */}
        {skillWork.length > 0 && (
          <div style={{ padding: "1.25rem 1.25rem 0" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.65rem", letterSpacing: "0.09em", textTransform: "uppercase", color: S.muscle }}>
              Skill work
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {skillWork.map((ex, i) => {
                const key = `skill:${i}`;
                return (
                  <ExerciseCard
                    key={i}
                    ex={ex}
                    values={setInputs[key] ?? []}
                    onChange={(setIdx, val) => updateRep(key, setIdx, val)}
                    swapped={swaps[key]}
                    onSwap={(name, reps) => handleSwap(key, name, reps)}
                    showClearNotice={!!clearedKeys[key]}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Main work */}
        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.65rem", letterSpacing: "0.09em", textTransform: "uppercase", color: S.muted }}>
            Main work
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {exercises.map((ex, i) => {
              const key = `main:${i}`;
              return (
                <ExerciseCard
                  key={i}
                  ex={ex}
                  values={setInputs[key] ?? []}
                  onChange={(setIdx, val) => updateRep(key, setIdx, val)}
                  swapped={swaps[key]}
                  onSwap={(name, reps) => handleSwap(key, name, reps)}
                />
              );
            })}
          </div>
        </div>

        {saveError && (
          <p style={{ margin: "1rem 1.25rem 0", fontSize: "0.8rem", color: S.rust }}>{saveError}</p>
        )}

        {/* Finish button */}
        <div style={{ padding: "1.5rem 1.25rem 0" }}>
          <button
            onClick={finishWorkout}
            disabled={saving}
            style={{
              width: "100%",
              background: saving ? S.surfaceHigh : S.muscle,
              color: saving ? S.muted : "#0f0f0e",
              border: saving ? `1px solid ${S.border}` : "none",
              borderRadius: "10px",
              padding: "1rem",
              fontSize: "0.95rem",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving…" : "Finish Workout"}
          </button>
        </div>

      </div>
    </main>
  );
}

// ─── Exercise card (active state) ─────────────────────────────────────────────

function ExerciseCard({
  ex,
  values,
  onChange,
  swapped,
  onSwap,
  showClearNotice = false,
}: {
  ex:       Exercise;
  values:   (number | "")[];
  onChange: (setIdx: number, val: string) => void;
  swapped?:         { name: string; reps: string };
  onSwap?:          (newName: string, newReps: string) => void;
  showClearNotice?: boolean;
}) {
  const [swapOpen, setSwapOpen] = useState(false);

  const displayName = swapped?.name ?? ex.name;
  const displayReps = swapped?.reps ?? ex.reps;
  const hasSwapped  = !!swapped;
  const swapOptions = ex.swapOptions;
  // Show Change button whenever there are any options (easier, harder, or alternatives)
  const canSwap = !!onSwap && !!swapOptions &&
    (swapOptions.easier.length > 0 || swapOptions.harder.length > 0 || swapOptions.alternatives.length > 0);

  function selectSwap(name: string) {
    if (!swapOptions || !onSwap) return;
    // Adjust prescription based on direction; alternatives keep the original
    const adjustedReps = swapOptions.easier.includes(name)
      ? adjustPrescription(ex.reps, "easier")
      : swapOptions.harder.includes(name)
      ? adjustPrescription(ex.reps, "harder")
      : ex.reps; // peer alternative — same difficulty, keep original prescription
    onSwap(name, adjustedReps);
    setSwapOpen(false);
  }

  return (
    <div style={{
      background: S.surface,
      border: `1px solid ${swapOpen ? "rgba(200,240,74,0.25)" : S.border}`,
      borderRadius: "10px",
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Main card content */}
      <div style={{ padding: "1rem 1rem 0.875rem" }}>

        {/* Name + badges row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.625rem" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: S.white, lineHeight: 1.25 }}>
                {displayName}
              </p>
              {hasSwapped && (
                <span style={{
                  fontSize: "0.6rem", fontWeight: 600, color: S.muted,
                  background: S.surfaceHigh, border: `1px solid ${S.border}`,
                  borderRadius: "3px", padding: "1px 5px", letterSpacing: "0.03em",
                  textTransform: "uppercase", flexShrink: 0,
                }}>
                  Swapped
                </span>
              )}
            </div>
            {ex.progressionNote && (
              <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: S.muted, lineHeight: 1.4 }}>
                {ex.progressionNote}
              </p>
            )}
            <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: S.mutedLight }}>
              {ex.sets} sets · {displayReps}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
            {ex.isHardSet && (
              <span style={{
                background: "rgba(200,240,74,0.12)",
                border: `1px solid rgba(200,240,74,0.3)`,
                borderRadius: "4px",
                padding: "2px 7px",
                fontSize: "0.62rem", fontWeight: 700,
                color: S.muscle, letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                Hard set
              </span>
            )}
            {ex.isSkillWork && !ex.isHardSet && (
              <span style={{
                background: "rgba(200,240,74,0.08)",
                border: `1px solid rgba(200,240,74,0.2)`,
                borderRadius: "4px",
                padding: "2px 7px",
                fontSize: "0.62rem", fontWeight: 700,
                color: S.muscle, letterSpacing: "0.04em", textTransform: "uppercase",
                opacity: 0.7,
              }}>
                Skill
              </span>
            )}
            {canSwap && (
              <button
                onClick={() => setSwapOpen(o => !o)}
                style={{
                  background: swapOpen ? "rgba(200,240,74,0.12)" : S.surfaceHigh,
                  border: `1px solid ${swapOpen ? "rgba(200,240,74,0.3)" : S.border}`,
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "0.62rem", fontWeight: 700,
                  color: swapOpen ? S.muscle : S.mutedLight,
                  letterSpacing: "0.04em", textTransform: "uppercase",
                  cursor: "pointer", lineHeight: 1.6,
                  transition: "background 0.12s, color 0.12s, border-color 0.12s",
                }}
              >
                {swapOpen ? "Close" : "Change"}
              </button>
            )}
          </div>
        </div>

        {/* Reps-cleared notice — shown only when a swap replaced a card that had reps entered */}
        {showClearNotice && (
          <p style={{
            margin: "0 0 0.5rem",
            fontSize: "0.68rem",
            color: S.muted,
            lineHeight: 1.4,
          }}>
            Exercise changed — previous reps cleared
          </p>
        )}

        {/* Set inputs */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Array.from({ length: ex.sets }).map((_, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: "44px" }}>
              <label style={{ fontSize: "0.6rem", color: S.muted, letterSpacing: "0.05em", textTransform: "uppercase", userSelect: "none" }}>
                Set {idx + 1}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values[idx] ?? ""}
                onChange={e => onChange(idx, e.target.value)}
                placeholder="—"
                style={{
                  width: "44px",
                  height: "38px",
                  background: S.surfaceHigh,
                  border: `1px solid ${(values[idx] !== "" && Number(values[idx]) > 0) ? "rgba(200,240,74,0.4)" : S.border}`,
                  borderRadius: "6px",
                  color: S.white,
                  fontSize: "0.95rem", fontWeight: 600,
                  textAlign: "center",
                  outline: "none",
                  fontVariantNumeric: "tabular-nums",
                  WebkitAppearance: "none",
                  MozAppearance: "textfield",
                } as React.CSSProperties}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Swap panel — inline expander inside the card */}
      {swapOpen && swapOptions && (
        <div style={{
          borderTop: `1px solid ${S.border}`,
          background: "#141413",
          padding: "0.75rem 1rem 0.875rem",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: S.mutedLight }}>
              Swap exercise
            </span>
            <span style={{ fontSize: "0.65rem", color: S.muted }}>
              This workout only
            </span>
          </div>

          {/* Option groups — exclude the current selection from easier/harder to avoid duplication */}
          {swapOptions.easier.filter(n => n !== displayName).length > 0 && (
            <SwapGroup
              label="Easier"
              names={swapOptions.easier.filter(n => n !== displayName)}
              isCurrent={false}
              onSelect={selectSwap}
            />
          )}

          <SwapGroup
            label="Current"
            names={[displayName]}
            isCurrent={true}
            onSelect={() => {}}
          />

          {swapOptions.harder.filter(n => n !== displayName).length > 0 && (
            <SwapGroup
              label="Harder"
              names={swapOptions.harder.filter(n => n !== displayName)}
              isCurrent={false}
              onSelect={selectSwap}
            />
          )}

          {/* Alternatives — peer variations at the same difficulty level.
              Exclude anything already shown in easier/harder/current to avoid duplicates. */}
          {swapOptions.alternatives
            .filter(n =>
              n !== displayName &&
              !swapOptions.easier.includes(n) &&
              !swapOptions.harder.includes(n)
            ).length > 0 && (
            <>
              <div style={{ borderTop: `1px solid ${S.border}`, margin: "0.4rem 0 0.55rem" }} />
              <SwapGroup
                label="Alternatives"
                names={swapOptions.alternatives.filter(n =>
                  n !== displayName &&
                  !swapOptions.easier.includes(n) &&
                  !swapOptions.harder.includes(n)
                )}
                isCurrent={false}
                onSelect={selectSwap}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Swap option group ────────────────────────────────────────────────────────

function SwapGroup({
  label,
  names,
  isCurrent,
  onSelect,
}: {
  label:     string;
  names:     string[];
  isCurrent: boolean;
  onSelect:  (name: string) => void;
}) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <p style={{
        margin: "0 0 0.25rem",
        fontSize: "0.6rem", fontWeight: 700,
        letterSpacing: "0.07em", textTransform: "uppercase",
        color: isCurrent ? S.muscle : S.muted,
      }}>
        {label}
      </p>
      {names.map(name => (
        <button
          key={name}
          onClick={() => !isCurrent && onSelect(name)}
          disabled={isCurrent}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: isCurrent ? "rgba(200,240,74,0.06)" : "transparent",
            border: `1px solid ${isCurrent ? "rgba(200,240,74,0.2)" : "transparent"}`,
            borderRadius: "6px",
            padding: "0.45rem 0.6rem",
            marginBottom: "0.2rem",
            fontSize: "0.84rem",
            fontWeight: isCurrent ? 600 : 400,
            color: isCurrent ? S.white : S.mutedLight,
            cursor: isCurrent ? "default" : "pointer",
            transition: "background 0.1s, color 0.1s",
          }}
          onMouseEnter={e => {
            if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = S.surfaceHigh;
          }}
          onMouseLeave={e => {
            if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {name}
          {isCurrent && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.65rem", color: S.muscle, fontWeight: 700 }}>
              ← now
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Evaluation row (done screen) ────────────────────────────────────────────

const OUTCOME_CONFIG = {
  ready_to_progress: { label: "Ready to advance",   color: "#c8f04a" },
  stay_here:         { label: "On track",            color: "#a0a090" },
  consider_easier:   { label: "Consider scaling",    color: "#e05a2b" },
  insufficient_data: { label: "Not logged",          color: "#6b6b60" },
} as const;

function EvalRow({ ev, last }: { ev: import("@/lib/workoutEval").ExerciseEval; last: boolean }) {
  const cfg = OUTCOME_CONFIG[ev.outcome];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      padding: "0.5rem 0",
      borderBottom: last ? "none" : `1px solid ${S.border}`,
      opacity: ev.outcome === "insufficient_data" ? 0.5 : 1,
    }}>
      <span style={{ fontSize: "0.845rem", color: S.white, lineHeight: 1.3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ev.name}
        {ev.isSkillWork && (
          <span style={{ marginLeft: "0.4rem", fontSize: "0.6rem", color: "#c8f04a", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            skill
          </span>
        )}
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: cfg.color, whiteSpace: "nowrap", flexShrink: 0 }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Exercise preview (idle state) ────────────────────────────────────────────

function ExercisePreviewSection({ label, labelColor, exercises }: { label: string; labelColor: string; exercises: Exercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.65rem", letterSpacing: "0.09em", textTransform: "uppercase", color: labelColor }}>
        {label}
      </p>
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "10px", overflow: "hidden" }}>
        {exercises.map((ex, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "0.75rem",
              padding: "0.65rem 1rem",
              borderBottom: i < exercises.length - 1 ? `1px solid ${S.border}` : "none",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontSize: "0.875rem", color: S.white, lineHeight: 1.3 }}>{ex.name}</span>
              {ex.progressionNote && (
                <span style={{ display: "block", fontSize: "0.68rem", color: S.muted, marginTop: "1px" }}>
                  {ex.progressionNote}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {ex.isHardSet && (
                <span style={{
                  background: "rgba(200,240,74,0.12)",
                  border: `1px solid rgba(200,240,74,0.25)`,
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "0.6rem", fontWeight: 700,
                  color: S.muscle, letterSpacing: "0.04em", textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  Hard
                </span>
              )}
              <span style={{ fontSize: "0.78rem", color: S.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {ex.sets}×{ex.reps}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
