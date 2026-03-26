"use client";

import { useState } from "react";
import type { Goal, AssessmentResult } from "@/types";

const GOALS: { value: Goal; label: string; emoji: string }[] = [
  { value: "lose-weight", label: "Lose weight", emoji: "🔥" },
  { value: "build-muscle", label: "Build muscle", emoji: "💪" },
  { value: "build-muscle-lose-weight", label: "Both", emoji: "⚡" },
];

const S = {
  // colours
  bg: "#0f0f0e",
  surface: "#1a1a18",
  surfaceHigh: "#222220",
  border: "#2e2e2b",
  borderHover: "#3e3e3a",
  muscle: "#c8f04a",
  rust: "#e05a2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  mutedLight: "#a0a090",
};

export default function Page() {
  const [pullUps, setPullUps] = useState("");
  const [pushUps, setPushUps] = useState("");
  const [dips, setDips] = useState("");
  const [goal, setGoal] = useState<Goal>("build-muscle");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullUps: Number(pullUps),
          pushUps: Number(pushUps),
          dips: Number(dips),
          goal,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return <ResultView result={result} onReset={() => setResult(null)} />;
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: S.bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "2.5rem 1.25rem",
      }}
    >
      <div style={{ maxWidth: "420px", width: "100%", margin: "0 auto" }}>
        {/* Badge */}
        <div style={{ marginBottom: "1.75rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: S.surfaceHigh,
              border: `1px solid ${S.border}`,
              color: S.muscle,
              borderRadius: "100px",
              padding: "0.3rem 0.85rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: S.muscle,
                display: "inline-block",
              }}
            />
            Free plan — no card needed
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(2.2rem, 8vw, 3rem)",
            fontWeight: 800,
            color: S.white,
            lineHeight: 1.05,
            marginBottom: "1rem",
            letterSpacing: "-0.02em",
          }}
        >
          Find your
          <br />
          <span style={{ color: S.muscle }}>calisthenics</span>
          <br />
          level.
        </h1>
        <p
          style={{
            color: S.muted,
            marginBottom: "2.25rem",
            fontSize: "0.95rem",
            lineHeight: 1.65,
          }}
        >
          3 questions. 30 seconds. A personalised 1-week plan built for where
          you actually are.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {/* Reps row */}
          <div>
            <p
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: S.muted,
                marginBottom: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Max reps you can do
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0.6rem",
              }}
            >
              {(
                [
                  { label: "Pull-ups", value: pullUps, set: setPullUps },
                  { label: "Push-ups", value: pushUps, set: setPushUps },
                  { label: "Dips", value: dips, set: setDips },
                ] as const
              ).map(({ label, value, set }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "1rem 0.5rem 0.6rem",
                      border: `1.5px solid ${S.border}`,
                      borderRadius: "12px",
                      background: S.surface,
                      color: S.white,
                      fontSize: "1.6rem",
                      fontWeight: 700,
                      textAlign: "center",
                      fontFamily: "inherit",
                    }}
                  />
                  <span
                    style={{
                      textAlign: "center",
                      fontSize: "0.72rem",
                      color: S.muted,
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div>
            <p
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: S.muted,
                marginBottom: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Your goal
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {GOALS.map((g) => {
                const active = goal === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      padding: "0.9rem 1.1rem",
                      border: `1.5px solid ${active ? S.muscle : S.border}`,
                      borderRadius: "12px",
                      background: active ? "rgba(200,240,74,0.07)" : S.surface,
                      color: active ? S.muscle : S.mutedLight,
                      fontSize: "0.95rem",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{g.emoji}</span>
                    {g.label}
                    {active && (
                      <span
                        style={{
                          marginLeft: "auto",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: S.muscle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.65rem",
                          color: S.bg,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email */}
          <div>
            <p
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: S.muted,
                marginBottom: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Where to send it
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.9rem 1.1rem",
                border: `1.5px solid ${S.border}`,
                borderRadius: "12px",
                background: S.surface,
                color: S.white,
                fontSize: "1rem",
                fontFamily: "inherit",
              }}
            />
            <p
              style={{
                fontSize: "0.72rem",
                color: S.muted,
                marginTop: "0.45rem",
              }}
            >
              No spam. Unsubscribe any time.
            </p>
          </div>

          {error && (
            <p style={{ color: S.rust, fontSize: "0.875rem" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              padding: "1.05rem",
              background: loading ? S.surfaceHigh : S.muscle,
              color: loading ? S.muted : S.bg,
              border: "none",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Building your plan…" : "Get my free plan →"}
          </button>
        </form>
      </div>
    </main>
  );
}

function ResultView({
  result,
  onReset,
}: {
  result: AssessmentResult;
  onReset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: S.bg,
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <span
            style={{
              display: "inline-block",
              background: S.muscle,
              color: S.bg,
              borderRadius: "100px",
              padding: "0.3rem 0.85rem",
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "1rem",
            }}
          >
            {result.level}
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(1.75rem, 6vw, 2.25rem)",
              fontWeight: 800,
              color: S.white,
              lineHeight: 1.1,
              marginBottom: "0.85rem",
              letterSpacing: "-0.02em",
            }}
          >
            Your 1-week plan
          </h1>
          <p
            style={{
              color: S.muted,
              lineHeight: 1.7,
              fontSize: "0.9rem",
              borderLeft: `3px solid ${S.border}`,
              paddingLeft: "0.85rem",
            }}
          >
            {result.summary}
          </p>
        </div>

        {/* Max -2 explanation */}
        <p style={{ color: S.muted, fontSize: "0.8rem", marginBottom: "1rem" }}>
          (Max -2 = stop 1–2 reps before failure — you should feel like you could do one more)
        </p>

        {/* Days */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          {result.plan.days.map((day) => (
            <div
              key={day.day}
              style={{
                background: S.surface,
                borderRadius: "14px",
                overflow: "hidden",
                border: `1.5px solid ${S.border}`,
              }}
            >
              {day.type === "rest" ? (
                <div
                  style={{
                    padding: "0.9rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: S.mutedLight,
                      minWidth: "80px",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {day.day}
                  </span>
                  <span style={{ color: S.muted, fontSize: "0.85rem" }}>
                    Rest & recover
                  </span>
                </div>
              ) : (
                <details>
                  <summary
                    style={{
                      padding: "0.9rem 1.1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      cursor: "pointer",
                      listStyle: "none",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: S.muscle,
                        minWidth: "80px",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}
                    >
                      {day.day}
                    </span>
                    <span
                      style={{
                        color: S.white,
                        fontWeight: 500,
                        fontSize: "0.875rem",
                        flex: 1,
                        lineHeight: 1.3,
                      }}
                    >
                      {day.focus}
                    </span>
                    <span style={{ color: S.muted, fontSize: "0.75rem", flexShrink: 0 }}>
                      ▾
                    </span>
                  </summary>
                  <div
                    style={{
                      borderTop: `1px solid ${S.border}`,
                      padding: "0.85rem 1.1rem",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                      {/* Table header */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: "0.5rem",
                          paddingBottom: "0.5rem",
                          borderBottom: `1px solid ${S.border}`,
                          marginBottom: "0.25rem",
                        }}
                      >
                        {["Exercise", "Sets", "Reps"].map((h) => (
                          <span
                            key={h}
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              color: S.muted,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              textAlign: h === "Exercise" ? "left" : "right",
                            }}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      {day.exercises?.map((ex, i) => (
                        <div
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto",
                            gap: "0.5rem",
                            padding: "0.55rem 0",
                            borderBottom: i < (day.exercises?.length ?? 0) - 1 ? `1px solid ${S.border}` : "none",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: S.white, fontSize: "0.875rem" }}>
                            {ex.name}
                          </span>
                          <span
                            style={{
                              color: S.mutedLight,
                              fontSize: "0.875rem",
                              textAlign: "right",
                              minWidth: "2rem",
                            }}
                          >
                            {ex.sets}
                          </span>
                          <span
                            style={{
                              color: S.mutedLight,
                              fontSize: "0.875rem",
                              textAlign: "right",
                              minWidth: "4rem",
                            }}
                          >
                            {ex.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Note */}
        <div
          style={{
            background: S.surfaceHigh,
            border: `1.5px solid ${S.border}`,
            borderRadius: "14px",
            padding: "1.1rem 1.25rem",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            lineHeight: 1.7,
            color: S.mutedLight,
          }}
        >
          <p
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: S.muted,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "0.5rem",
            }}
          >
            Coach note
          </p>
          {result.plan.note}
        </div>

        <button
          onClick={onReset}
          style={{
            background: "transparent",
            border: `1.5px solid ${S.border}`,
            borderRadius: "12px",
            padding: "0.75rem 1.25rem",
            color: S.muted,
            cursor: "pointer",
            fontSize: "0.875rem",
            fontFamily: "inherit",
          }}
        >
          ← Start over
        </button>
      </div>
    </main>
  );
}
