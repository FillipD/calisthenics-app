"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Exercise } from "@/types";

const S = {
  bg: "#0f0f0e",
  surface: "#1a1a18",
  surfaceHigh: "#222220",
  border: "#2e2e2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  mutedLight: "#a0a090",
  muscle: "#c8f04a",
  rust: "#e05a2b",
};

interface ExistingLog {
  exercise_name: string;
  sets_completed: number;
  reps_completed: number;
}

interface Props {
  day: string;
  focus: string;
  exercises: Exercise[];
  skillWork: Exercise[];
  existingLogs: ExistingLog[];
}

export default function LogForm({ day, focus, exercises, skillWork, existingLogs }: Props) {
  const router = useRouter();
  const [logs, setLogs] = useState(
    exercises.map((ex) => {
      const prior = existingLogs.find((l) => l.exercise_name === ex.name);
      return {
        sets: prior ? String(prior.sets_completed) : "",
        reps: prior ? String(prior.reps_completed || "") : "",
      };
    })
  );
  const [skillLogs, setSkillLogs] = useState(
    skillWork.map((ex) => {
      const prior = existingLogs.find((l) => l.exercise_name === ex.name);
      return {
        sets: prior ? String(prior.sets_completed) : "",
        reps: prior ? String(prior.reps_completed || "") : "",
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, field: "sets" | "reps", value: string) {
    setLogs((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }

  function updateSkill(i: number, field: "sets" | "reps", value: string) {
    setSkillLogs((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day,
        exercises: [
          ...skillWork.map((ex, i) => ({
            name: ex.name,
            setsCompleted: parseInt(skillLogs[i].sets) || 0,
            repsCompleted: parseInt(skillLogs[i].reps) || 0,
          })),
          ...exercises.map((ex, i) => ({
            name: ex.name,
            setsCompleted: parseInt(logs[i].sets) || 0,
            repsCompleted: parseInt(logs[i].reps) || 0,
          })),
        ],
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSaving(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* Back link */}
        <Link
          href="/dashboard"
          style={{ fontSize: "0.8rem", color: S.muted, textDecoration: "none", letterSpacing: "0.04em", display: "inline-block", marginBottom: "1.75rem" }}
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.rust }}>
            {day}
          </p>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {focus}
          </h1>
        </div>

        {/* Skill work — shown before main exercises for pull/push, after for legs */}
        {skillWork.length > 0 && !focus.startsWith("Legs") && (
          <LogTable
            label="Skill Work"
            labelColor={S.rust}
            exercises={skillWork}
            logs={skillLogs}
            onUpdate={updateSkill}
          />
        )}

        {/* Main exercise rows */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "1.5rem" }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", gap: "0.75rem", padding: "0.65rem 1.25rem", borderBottom: `1px solid ${S.border}` }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted }}>Exercise</span>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "center" }}>Target sets</span>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "center" }}>Target reps</span>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muscle, textAlign: "center" }}>Sets done</span>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muscle, textAlign: "center" }}>Reps done</span>
          </div>

          {exercises.map((ex, i) => {
            const isHold = ex.reps.includes("sec");
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px 80px 80px",
                  gap: "0.75rem",
                  padding: "0.85rem 1.25rem",
                  borderBottom: i < exercises.length - 1 ? `1px solid ${S.border}` : "none",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.875rem", color: S.white }}>
                  {ex.name}
                  {ex.progressionNote && (
                    <span style={{ display: "block", fontSize: "0.7rem", color: S.muted, marginTop: "2px", fontWeight: 400 }}>
                      {ex.progressionNote}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "center" }}>{ex.sets}</span>
                <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "center" }}>
                  {isHold ? "Max Hold" : ex.reps}
                </span>

                <input
                  type="number"
                  min={0}
                  value={logs[i].sets}
                  onChange={(e) => update(i, "sets", e.target.value)}
                  placeholder="—"
                  style={{
                    background: S.surfaceHigh,
                    border: `1px solid ${S.border}`,
                    borderRadius: "6px",
                    color: S.white,
                    fontSize: "0.875rem",
                    padding: "0.4rem 0.5rem",
                    textAlign: "center",
                    width: "100%",
                    outline: "none",
                  }}
                />

                {isHold ? (
                  <span style={{ fontSize: "0.8rem", color: S.muted, textAlign: "center" }}>—</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={logs[i].reps}
                    onChange={(e) => update(i, "reps", e.target.value)}
                    placeholder="—"
                    style={{
                      background: S.surfaceHigh,
                      border: `1px solid ${S.border}`,
                      borderRadius: "6px",
                      color: S.white,
                      fontSize: "0.875rem",
                      padding: "0.4rem 0.5rem",
                      textAlign: "center",
                      width: "100%",
                      outline: "none",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {skillWork.length > 0 && focus.startsWith("Legs") && (
          <LogTable
            label="Skill Work"
            labelColor={S.rust}
            exercises={skillWork}
            logs={skillLogs}
            onUpdate={updateSkill}
          />
        )}

        {error && (
          <p style={{ color: S.rust, fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: "100%",
            background: saving ? S.border : S.muscle,
            color: saving ? S.muted : "#0f0f0e",
            border: "none",
            borderRadius: "8px",
            padding: "0.9rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            transition: "background 0.15s",
          }}
        >
          {saving ? "Saving…" : "Save workout"}
        </button>

      </div>
    </main>
  );
}

interface LogTableProps {
  label: string;
  labelColor: string;
  exercises: Exercise[];
  logs: { sets: string; reps: string }[];
  onUpdate: (i: number, field: "sets" | "reps", value: string) => void;
}

function LogTable({ label, labelColor, exercises, logs, onUpdate }: LogTableProps) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", gap: "0.75rem", padding: "0.65rem 1.25rem", borderBottom: `1px solid ${S.border}` }}>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: labelColor }}>{label}</span>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "center" }}>Target sets</span>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "center" }}>Target</span>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muscle, textAlign: "center" }}>Sets done</span>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muscle, textAlign: "center" }}>Reps done</span>
      </div>
      {exercises.map((ex, i) => {
        const isHold = ex.reps.includes("sec");
        return (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px", gap: "0.75rem", padding: "0.85rem 1.25rem", borderBottom: i < exercises.length - 1 ? `1px solid ${S.border}` : "none", alignItems: "center" }}
          >
            <span style={{ fontSize: "0.875rem", color: S.white }}>
              {ex.name}
              {ex.progressionNote && (
                <span style={{ display: "block", fontSize: "0.7rem", color: S.muted, marginTop: "2px", fontWeight: 400 }}>
                  {ex.progressionNote}
                </span>
              )}
            </span>
            <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "center" }}>{ex.sets}</span>
            <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "center" }}>{isHold ? "Max Hold" : ex.reps}</span>
            <input
              type="number"
              min={0}
              value={logs[i].sets}
              onChange={(e) => onUpdate(i, "sets", e.target.value)}
              placeholder="—"
              style={{ background: S.surfaceHigh, border: `1px solid ${S.border}`, borderRadius: "6px", color: S.white, fontSize: "0.875rem", padding: "0.4rem 0.5rem", textAlign: "center", width: "100%", outline: "none" }}
            />
            {isHold ? (
              <span style={{ fontSize: "0.8rem", color: S.muted, textAlign: "center" }}>—</span>
            ) : (
              <input
                type="number"
                min={0}
                value={logs[i].reps}
                onChange={(e) => onUpdate(i, "reps", e.target.value)}
                placeholder="—"
                style={{ background: S.surfaceHigh, border: `1px solid ${S.border}`, borderRadius: "6px", color: S.white, fontSize: "0.875rem", padding: "0.4rem 0.5rem", textAlign: "center", width: "100%", outline: "none" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
