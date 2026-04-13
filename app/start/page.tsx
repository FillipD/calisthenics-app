"use client";

import { useState } from "react";
import type { Goal, AssessmentResult } from "@/types";
import { getPreviewTree } from "@/lib/skillTeaser";
import type { PreviewTreeData } from "@/lib/skillTeaser";

const GOALS: { value: Goal; label: string; emoji: string }[] = [
  { value: "build-strength", label: "Build strength", emoji: "🏋️" },
  { value: "build-muscle", label: "Build muscle", emoji: "💪" },
  { value: "build-strength-muscle", label: "Both", emoji: "⚡" },
];

const EQUIPMENT_OPTIONS = [
  "Pull-up bar",
  "Parallel bars / dip bars",
  "Rings",
  "Parallettes",
  "Resistance bands",
  "Nordic curl anchor",
  "Weights (belt or vest)",
  "Vertical pole",
  "Bodyweight only",
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
  const [goal, setGoal] = useState<Goal>("build-strength");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  function toggleEquipment(item: string) {
    if (item === "Bodyweight only") {
      setEquipment(["Bodyweight only"]);
    } else {
      setEquipment(prev => {
        const without = prev.filter(e => e !== "Bodyweight only" && e !== item);
        return prev.includes(item) ? without : [...without, item];
      });
    }
  }

  async function handleTestSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pullUps: 5, pushUps: 20, dips: 5, goal: "build-strength", daysPerWeek: 3, equipment: ["Pull-up bar"], email: "test@test.com" }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

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
          daysPerWeek,
          equipment,
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
    return <ResultView result={result} formData={{ pullUps: Number(pullUps), pushUps: Number(pushUps), dips: Number(dips) }} onReset={() => setResult(null)} />;
  }

  const isDev = process.env.NODE_ENV === "development";

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

          {/* Days per week */}
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
              How many days per week do you want to train?
            </p>
            <div style={{ display: "flex", gap: "0.45rem" }}>
              {[1, 2, 3, 4, 5, 6].map(n => {
                const active = daysPerWeek === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDaysPerWeek(n)}
                    style={{
                      flex: 1,
                      padding: "0.75rem 0",
                      border: `1.5px solid ${active ? S.muscle : S.border}`,
                      borderRadius: "10px",
                      background: active ? "rgba(200,240,74,0.07)" : S.surface,
                      color: active ? S.muscle : S.mutedLight,
                      fontSize: "1rem",
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipment */}
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
              What equipment do you have access to?
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.45rem",
              }}
            >
              {EQUIPMENT_OPTIONS.map(option => {
                const active = equipment.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleEquipment(option)}
                    style={{
                      gridColumn: option === "Bodyweight only" ? "span 2" : undefined,
                      padding: "0.75rem 0.9rem",
                      border: `1.5px solid ${active ? S.muscle : S.border}`,
                      borderRadius: "10px",
                      background: active ? "rgba(200,240,74,0.07)" : S.surface,
                      color: active ? S.muscle : S.mutedLight,
                      fontSize: "0.82rem",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      lineHeight: 1.35,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                  >
                    {active && (
                      <span style={{ marginRight: "0.4rem", fontSize: "0.65rem" }}>✓</span>
                    )}
                    {option}
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
        {isDev && (
          <button
            onClick={handleTestSubmit}
            style={{ marginTop: "1rem", background: "none", border: "1px dashed #444", color: "#666", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" }}
          >
            [dev] skip form
          </button>
        )}
      </div>
    </main>
  );
}

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function SkillTreePreview({ data }: { data: PreviewTreeData }) {
  // Small cells so the full tree fits in a compact space — text is intentionally unreadable
  const cellW = 46;
  const cellH = 44;
  const nodeW = 32;
  const nodeH = 28;
  const treeW = data.cols * cellW + nodeW;
  const treeH = data.rows * cellH + nodeH;

  return (
    <svg width={treeW} height={treeH} style={{ display: "block" }}>
      {/* Edges */}
      {data.edges.map((edge, i) => {
        const fromNode = data.nodes.find(n => n.id === edge.fromId);
        const toNode = data.nodes.find(n => n.id === edge.toId);
        if (!fromNode || !toNode) return null;
        const x1 = fromNode.col * cellW + nodeW / 2;
        const y1 = fromNode.row * cellH + nodeH / 2;
        const x2 = toNode.col * cellW + nodeW / 2;
        const y2 = toNode.row * cellH + nodeH / 2;
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={edge.lit ? "rgba(200,240,74,0.3)" : "#2e2e2b"}
            strokeWidth={1}
          />
        );
      })}
      {/* Hexagon nodes — no text, just colored shapes */}
      {data.nodes.map((node) => {
        const cx = node.col * cellW + nodeW / 2;
        const cy = node.row * cellH + nodeH / 2;
        const rx = nodeW / 2;
        const ry = nodeH / 2;
        // Flat-top hexagon points
        const pts = [
          [cx, cy - ry],
          [cx + rx, cy - ry * 0.5],
          [cx + rx, cy + ry * 0.5],
          [cx, cy + ry],
          [cx - rx, cy + ry * 0.5],
          [cx - rx, cy - ry * 0.5],
        ].map(p => p.join(",")).join(" ");

        let fill = "#1a1a18";
        let opacity = 0.45;
        let glowFilter: string | undefined;

        if (node.state === "current") {
          fill = "#c8f04a"; opacity = 1;
          glowFilter = "url(#glow)";
        } else if (node.state === "past") {
          fill = "#f5f0e8"; opacity = 0.8;
        } else if (node.state === "goal") {
          fill = "#c8f04a"; opacity = 0.3;
        }

        return (
          <polygon
            key={node.id}
            points={pts}
            fill={fill}
            opacity={opacity}
            stroke={node.state === "goal" ? "rgba(200,240,74,0.4)" : "rgba(46,46,43,0.5)"}
            strokeWidth={0.5}
            filter={glowFilter}
          />
        );
      })}
      {/* Glow filter for current node */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function ResultView({
  result,
  formData,
  onReset,
}: {
  result: AssessmentResult;
  formData: { pullUps: number; pushUps: number; dips: number };
  onReset: () => void;
}) {
  const pullTree = getPreviewTree("pull", formData.pullUps, formData.pushUps, formData.dips);

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
          (Max -2 = stop 1-2 reps before failure -- you should feel like you could do one more)
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
                            {ex.reps.includes("sec") ? "Max Hold" : ex.reps}
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

        {/* ── Transition divider ─────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div
            style={{
              width: "40px",
              height: "3px",
              background: S.muscle,
              borderRadius: "2px",
              marginBottom: "1.25rem",
            }}
          />
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(1.4rem, 5vw, 1.75rem)",
              fontWeight: 800,
              color: S.white,
              lineHeight: 1.15,
              marginBottom: "0.65rem",
              letterSpacing: "-0.02em",
            }}
          >
            This is week 1.<br />
            Here&apos;s where it leads.
          </h2>
          <p
            style={{
              color: S.muted,
              fontSize: "0.9rem",
              lineHeight: 1.65,
            }}
          >
            Your rep counts place you on a clear path to skills most people think are impossible.
          </p>
        </div>

        {/* ── Skill tree preview ───────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "16px",
            border: `1.5px solid ${S.border}`,
            background: S.bg,
            height: "340px",
            marginBottom: "1.5rem",
          }}
        >
          {/* Category tabs */}
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              left: "0.75rem",
              display: "flex",
              gap: "0.35rem",
              zIndex: 3,
            }}
          >
            {["Pull", "Push", "Legs", "Core"].map((cat) => (
              <span
                key={cat}
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 600,
                  color: cat === "Pull" ? S.muscle : S.muted,
                  background: cat === "Pull" ? "rgba(200,240,74,0.12)" : "rgba(26,26,24,0.85)",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "5px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  border: `1px solid ${cat === "Pull" ? "rgba(200,240,74,0.25)" : "rgba(46,46,43,0.6)"}`,
                  backdropFilter: "blur(4px)",
                }}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Tree — centered, zoomed out, no readable text */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "2.5rem",
              paddingBottom: "4rem",
            }}
          >
            <SkillTreePreview data={pullTree} />
          </div>

          {/* Edge fades */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1,
              background: `
                linear-gradient(to bottom, ${S.bg} 0%, transparent 15%, transparent 50%, ${S.bg} 90%),
                linear-gradient(to right, ${S.bg} 0%, transparent 10%, transparent 90%, ${S.bg} 100%)
              `,
            }}
          />

          {/* Bottom overlay with text */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 3,
              padding: "1.5rem 1.25rem 1rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
                color: S.white,
                marginBottom: "0.3rem",
              }}
            >
              Your full progression map
            </p>
            <p
              style={{
                fontSize: "0.72rem",
                color: S.muted,
              }}
            >
              100+ exercises across Pull, Push, Legs &amp; Core
            </p>
          </div>
        </div>

        {/* ── Free vs Pro comparison table ──────────────────────────────── */}
        <div
          style={{
            background: S.surface,
            border: `1.5px solid ${S.border}`,
            borderRadius: "14px",
            overflow: "hidden",
            marginBottom: "1.5rem",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 70px",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <div style={{ padding: "0.85rem 1rem" }} />
            <div
              style={{
                padding: "0.85rem 0",
                textAlign: "center",
                fontSize: "0.72rem",
                fontWeight: 600,
                color: S.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Free
            </div>
            <div
              style={{
                padding: "0.85rem 0",
                textAlign: "center",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: S.muscle,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "rgba(200,240,74,0.05)",
              }}
            >
              Pro
            </div>
          </div>
          {/* Table rows */}
          {[
            { feature: "1-week plan", free: true, pro: true },
            { feature: "Adaptive weekly plans", free: false, pro: true },
            { feature: "Skill tree progressions", free: false, pro: true },
            { feature: "Workout logging", free: false, pro: true },
            { feature: "Progress tracking", free: false, pro: true },
            { feature: "Personalised coaching", free: false, pro: true },
          ].map((row, i, arr) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 70px",
                borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : "none",
              }}
            >
              <div
                style={{
                  padding: "0.7rem 1rem",
                  fontSize: "0.85rem",
                  color: S.white,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {row.feature}
              </div>
              <div
                style={{
                  padding: "0.7rem 0",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.95rem",
                }}
              >
                {row.free ? "✅" : "❌"}
              </div>
              <div
                style={{
                  padding: "0.7rem 0",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.95rem",
                  background: "rgba(200,240,74,0.05)",
                }}
              >
                ✅
              </div>
            </div>
          ))}
        </div>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <div
          style={{
            background: `linear-gradient(135deg, rgba(200,240,74,0.08) 0%, rgba(200,240,74,0.02) 100%)`,
            border: `1.5px solid rgba(200,240,74,0.25)`,
            borderRadius: "16px",
            padding: "1.75rem 1.25rem",
            marginBottom: "1.25rem",
            textAlign: "center",
          }}
        >
          <h3
            className="font-display"
            style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              color: S.white,
              marginBottom: "0.6rem",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            Train with a system, not just a plan
          </h3>
          <p
            style={{
              color: S.muted,
              fontSize: "0.875rem",
              lineHeight: 1.65,
              marginBottom: "1.25rem",
            }}
          >
            Pro generates a new plan every week based on what you log. Your workouts get smarter as you progress.
          </p>
          <a
            href="/pricing"
            style={{
              display: "block",
              background: S.muscle,
              color: S.bg,
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              textAlign: "center",
              fontSize: "1rem",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            Start training with Pro
          </a>
        </div>

        <p style={{ color: S.muted, fontSize: "0.8rem", marginBottom: "1rem", textAlign: "center" }}>
          This plan has also been sent to your email. If you don&apos;t see it, check your spam folder.
        </p>

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
            width: "100%",
          }}
        >
          Start over
        </button>
      </div>
    </main>
  );
}
