"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { WeeklyPlan, TrainingDay, Exercise } from "@/types";
import { track } from "@/lib/analytics";

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

const DAY_ABBREV: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const REST_MESSAGES: Record<string, string> = {
  Monday:    "Start the week with good sleep and nutrition.",
  Tuesday:   "Active recovery — a walk or light stretch goes a long way.",
  Wednesday: "Halfway through. Rest well.",
  Thursday:  "Let the adaptations from this week's training settle in.",
  Friday:    "Rest up before the weekend sessions.",
  Saturday:  "Recovery day. Hydrate and move lightly.",
  Sunday:    "Rest day. Prepare mentally for the week ahead.",
};

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function getTodayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function shortFocus(focus?: string): string {
  if (!focus) return "Training";
  if (focus.startsWith("Pull")) return "Pull";
  if (focus.startsWith("Push")) return "Push";
  if (focus.startsWith("Legs")) return "Legs";
  if (focus.startsWith("Full")) return "Full Body";
  return focus.split("—")[0].trim();
}

interface Props {
  initialPlan: WeeklyPlan | null;
  firstName:   string | null;
  week:        number;
  level:       string;
  goal:        string;
}

function reorderDays(days: TrainingDay[], fromDay: string, toDay: string): TrainingDay[] {
  const fromIdx = days.findIndex(d => d.day === fromDay);
  const toIdx   = days.findIndex(d => d.day === toDay);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return days;
  const newDays = [...days];
  const { day: fromLabel, ...fromContent } = newDays[fromIdx];
  const { day: toLabel,   ...toContent   } = newDays[toIdx];
  newDays[fromIdx] = { day: fromLabel, ...toContent };
  newDays[toIdx]   = { day: toLabel,   ...fromContent };
  return newDays;
}

export default function DashboardClient({ initialPlan, firstName, week, level, goal }: Props) {
  const [plan,            setPlan]            = useState<WeeklyPlan | null>(initialPlan);
  const [generating,      setGenerating]      = useState(false);
  const [message,         setMessage]         = useState<string | null>(null);
  const [updatedAt,       setUpdatedAt]       = useState<string | null>(null);
  const [todayExpanded,   setTodayExpanded]   = useState(false);
  const [expandedWeekDay, setExpandedWeekDay] = useState<string | null>(null);
  const [showWelcome,     setShowWelcome]     = useState(false);
  const [dragDay,         setDragDay]         = useState<string | null>(null);
  const [dropTarget,      setDropTarget]      = useState<string | null>(null);
  const [saving,          setSaving]          = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Fired here for users who go straight to the dashboard after checkout
      // (i.e. they had already completed pro onboarding previously). The other
      // path — first-time pro users — fires checkout_completed from
      // ProOnboardingFormV2 instead.
      track("checkout_completed", { source: "dashboard" });
    }
    if (params.get("success") === "true" || params.get("checkout") === "success") {
      setShowWelcome(true);
      const t = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  async function handleGenerate() {
    const isFirstPlan = !plan;
    track("generate_plan_clicked", { isFirstPlan, source: "dashboard" });

    setGenerating(true);
    setMessage(null);
    setUpdatedAt(null);
    try {
      const res  = await fetch("/api/plan/generate", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPlan(data.plan);
        setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        if (isFirstPlan) {
          track("first_plan_generated", { source: "dashboard" });
        }
      } else {
        track("generate_plan_failed", { source: "dashboard", status: res.status });
        setMessage(
          typeof data.error === "string"
            ? data.error
            : "Something went wrong. Try again.",
        );
      }
    } catch {
      track("generate_plan_failed", { source: "dashboard", status: "network_error" });
      setMessage("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDrop(fromDay: string, toDay: string) {
    if (!plan || fromDay === toDay) return;
    const newDays = reorderDays(plan.days, fromDay, toDay);
    setPlan({ ...plan, days: newDays }); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/plan/days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: newDays }),
      });
      if (res.ok) {
        setUpdatedAt("Layout saved");
        setTimeout(() => setUpdatedAt(null), 2500);
      } else {
        setPlan(plan); // revert
      }
    } catch {
      setPlan(plan); // revert
    } finally {
      setSaving(false);
    }
  }

  const todayName = getTodayName();
  const todayDay  = plan?.days.find(d => d.day.toLowerCase() === todayName.toLowerCase()) ?? null;
  const goalLabel = goal.replace(/-/g, " ");

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2rem 1.25rem 5rem" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* ── Welcome banner ── */}
        {showWelcome && (
          <div
            style={{
              background: "rgba(200,240,74,0.1)",
              border: `1.5px solid rgba(200,240,74,0.35)`,
              borderRadius: "10px",
              padding: "0.9rem 1.1rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", color: S.muscle, fontWeight: 600, lineHeight: 1.45 }}>
              Welcome to CaliPlan Pro! Generate your first personalised plan below.
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: "1rem", padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 3px", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
              Week {week} · {goalLabel}
            </p>
            <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.15 }} suppressHydrationWarning>
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              flexShrink: 0,
              marginTop: "6px",
              background: "transparent",
              border: `1px solid ${S.border}`,
              borderRadius: "6px",
              padding: "5px 11px",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: generating ? S.muted : S.mutedLight,
              cursor: generating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              transition: "color 0.15s",
            }}
          >
            {generating ? "Generating…" : plan ? "New plan" : "Generate plan"}
          </button>
        </div>

        {message && (
          <p style={{ margin: "-1.25rem 0 1.25rem", fontSize: "0.8rem", color: S.rust }}>{message}</p>
        )}
        {updatedAt && (
          <p style={{ margin: "-1.25rem 0 1.25rem", fontSize: "0.75rem", color: S.muscle }}>
            ✓ {updatedAt.startsWith("Layout") ? updatedAt : `Plan updated at ${updatedAt}`}
          </p>
        )}

        {generating ? (

          /* ── Generation loading state ── */
          <div style={{
            background: S.surface,
            border: `1px solid ${S.border}`,
            borderLeft: `3px solid ${S.muscle}`,
            borderRadius: "12px",
            padding: "3rem 1.5rem",
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: S.white }}>
              Building your plan…
            </p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: S.muted, lineHeight: 1.65 }}>
              Gemini is crafting your personalised weekly programme.
              <br />This usually takes 15–25 seconds.
            </p>
          </div>

        ) : !plan ? (

          /* ── No plan empty state ── */
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "12px", padding: "3rem 1.5rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600, color: S.white }}>No plan yet</p>
            <p style={{ margin: 0, fontSize: "0.85rem", color: S.muted, lineHeight: 1.65 }}>
              Tap "Generate plan" above to get your personalised training plan.
            </p>
          </div>

        ) : (
          <>
            {/* ── TODAY ── */}
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
              Today
            </p>

            {!todayDay ? (
              <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "10px", padding: "1.25rem", marginBottom: "2rem" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: S.muted }}>No session scheduled for today.</p>
              </div>
            ) : todayDay.type === "rest" ? (
              <RestCard day={todayDay} />
            ) : (
              <TodayCard
                day={todayDay}
                expanded={todayExpanded}
                onToggle={() => setTodayExpanded(v => !v)}
              />
            )}

            {/* ── THIS WEEK ── */}
            <p style={{ margin: "2rem 0 0.6rem", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
              This week
            </p>
            <ThisWeek
              days={plan.days}
              todayName={todayName}
              expandedDay={expandedWeekDay}
              onDayClick={(name) => setExpandedWeekDay(prev => prev === name ? null : name)}
              dragDay={dragDay}
              dropTarget={dropTarget}
              saving={saving}
              onDragStart={(name) => setDragDay(name)}
              onDragEnter={(name) => setDropTarget(name || null)}
              onDragEnd={() => { setDragDay(null); setDropTarget(null); }}
              onDrop={(from, to) => handleDrop(from, to)}
            />

            {/* ── Coaching note ── */}
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderLeft: `3px solid ${S.muscle}`, borderRadius: "8px", padding: "1rem 1.25rem", marginTop: "2rem" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.65rem", letterSpacing: "0.09em", textTransform: "uppercase", color: S.muscle }}>
                Coaching note
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: S.mutedLight, lineHeight: 1.7, fontStyle: "italic" }}>
                {plan.note}
              </p>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

// ─── Rest card ────────────────────────────────────────────────────────────────

function RestCard({ day }: { day: TrainingDay }) {
  const msg = REST_MESSAGES[day.day] ?? "Take it easy today.";
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "10px", padding: "1.25rem 1.5rem", marginBottom: "0", opacity: 0.7 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: "0 0 3px", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
          {day.day}
        </p>
        <span style={{ fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted }}>Rest</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: S.mutedLight, lineHeight: 1.6 }}>{msg}</p>
    </div>
  );
}

// ─── Today hero card ──────────────────────────────────────────────────────────

function TodayCard({ day, expanded, onToggle }: { day: TrainingDay; expanded: boolean; onToggle: () => void }) {
  const exercises  = day.exercises ?? [];
  const skillWork  = day.skillWork ?? [];
  const hasSkill   = skillWork.length > 0;
  const preview    = exercises.slice(0, 3);
  const hasMore    = exercises.length > 3;

  return (
    <div style={{ background: S.surfaceHigh, border: `1px solid ${S.border}`, borderLeft: `3px solid ${S.muscle}`, borderRadius: "10px", overflow: "hidden" }}>

      {/* Card header */}
      <div style={{ padding: "1.25rem 1.25rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
              {day.day}
            </p>
            <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: S.white, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {day.focus}
            </p>
          </div>
          {hasSkill && (
            <span style={{
              flexShrink: 0,
              background: "rgba(200,240,74,0.12)",
              border: `1px solid rgba(200,240,74,0.3)`,
              borderRadius: "5px",
              padding: "3px 8px",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: S.muscle,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              Skill work
            </span>
          )}
        </div>
      </div>

      {/* Exercise preview — skill work always first */}
      <div style={{ padding: "0 1.25rem" }}>
        {hasSkill && (
          <>
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muscle }}>
              Skill work
            </p>
            {skillWork.map((ex, i) => (
              <ExerciseRow key={i} ex={ex} last={i === skillWork.length - 1 && !expanded && exercises.length === 0} />
            ))}
            {(expanded || exercises.length > 0) && (
              <div style={{ borderTop: `1px solid ${S.border}`, margin: "0.25rem 0 0.5rem" }}>
                <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
                  Main work
                </p>
              </div>
            )}
          </>
        )}

        {(expanded ? exercises : preview).map((ex, i) => (
          <ExerciseRow key={i} ex={ex} last={i === (expanded ? exercises.length : preview.length) - 1} />
        ))}
      </div>

      {/* Toggle + Log button */}
      <div style={{ padding: "0.75rem 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {(hasMore || hasSkill) && (
          <button
            onClick={onToggle}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "0.75rem",
              color: S.muted,
              cursor: "pointer",
              textAlign: "left",
              letterSpacing: "0.01em",
            }}
          >
            {expanded ? "Hide full workout ↑" : `Show full workout (${exercises.length} exercises${hasSkill ? " + skill work" : ""}) ↓`}
          </button>
        )}
        <Link
          href={`/workout/${day.day}`}
          style={{
            display: "block",
            background: S.muscle,
            color: "#0f0f0e",
            borderRadius: "8px",
            padding: "0.8rem",
            textAlign: "center",
            fontSize: "0.875rem",
            fontWeight: 700,
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Start Workout →
        </Link>
      </div>
    </div>
  );
}

// ─── This week row ────────────────────────────────────────────────────────────

function ThisWeek({
  days,
  todayName,
  expandedDay,
  onDayClick,
  dragDay,
  dropTarget,
  saving,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  days:        TrainingDay[];
  todayName:   string;
  expandedDay: string | null;
  onDayClick:  (name: string) => void;
  dragDay:     string | null;
  dropTarget:  string | null;
  saving:      boolean;
  onDragStart: (name: string) => void;
  onDragEnter: (name: string) => void;
  onDragEnd:   () => void;
  onDrop:      (from: string, to: string) => void;
}) {
  const expanded = days.find(d => d.day === expandedDay);

  return (
    <div>
      {/* Scrollable pill row */}
      <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
        {days.map(day => {
          const isToday    = day.day.toLowerCase() === todayName.toLowerCase();
          const isRest     = day.type === "rest";
          const isExpanded = day.day === expandedDay;
          const isDragging = day.day === dragDay;
          const isTarget   = day.day === dropTarget && dragDay !== null && day.day !== dragDay;

          return (
            <button
              key={day.day}
              draggable={!isRest && !saving}
              onClick={() => !isRest && !dragDay && onDayClick(day.day)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                onDragStart(day.day);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (day.day !== dragDay) onDragEnter(day.day);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragDay) onDrop(dragDay, day.day);
                onDragEnd();
              }}
              onDragEnd={onDragEnd}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                background: isExpanded ? S.surfaceHigh : S.surface,
                border: `1px solid ${isTarget ? S.muscle : isToday ? S.muscle : S.border}`,
                borderRadius: "8px",
                padding: "0.6rem 0.75rem",
                cursor: isRest ? "default" : saving ? "wait" : dragDay ? "grabbing" : "grab",
                minWidth: "56px",
                transition: "border-color 0.15s, opacity 0.15s",
                opacity: isDragging ? 0.35 : isRest ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isToday ? S.muscle : S.muted }}>
                {DAY_ABBREV[day.day] ?? day.day.slice(0, 3)}
              </span>
              <span style={{ fontSize: "0.62rem", color: isRest ? S.muted : S.mutedLight, whiteSpace: "nowrap" }}>
                {isRest ? "Rest" : shortFocus(day.focus)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {expanded && expanded.type === "training" && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", padding: "1rem 1.25rem", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <p style={{ margin: "0 0 1px", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>{expanded.day}</p>
              <p style={{ margin: 0, fontSize: "0.925rem", fontWeight: 600, color: S.white }}>{expanded.focus}</p>
            </div>
            <Link
              href={`/workout/${expanded.day}`}
              style={{ background: S.surfaceHigh, border: `1px solid ${S.border}`, color: S.mutedLight, padding: "0.35rem 0.8rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Start →
            </Link>
          </div>

          {/* Skill work first for all session types */}
          {expanded.skillWork && expanded.skillWork.length > 0 && (
            <ExerciseSection label="Skill work" labelColor={S.muscle} exercises={expanded.skillWork} />
          )}
          <ExerciseSection label="Main work" labelColor={S.muted} exercises={expanded.exercises ?? []} />
        </div>
      )}
    </div>
  );
}

// ─── Shared exercise components ───────────────────────────────────────────────

function ExerciseRow({ ex, last }: { ex: Exercise; last: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "0.75rem",
      padding: "0.55rem 0",
      borderBottom: last ? "none" : `1px solid ${S.border}`,
      alignItems: "center",
    }}>
      <span style={{ fontSize: "0.845rem", color: S.white, lineHeight: 1.3 }}>
        {ex.name}
        {ex.progressionNote && (
          <span style={{ display: "block", fontSize: "0.68rem", color: S.muted, marginTop: "1px" }}>
            {ex.progressionNote}
          </span>
        )}
      </span>
      <span style={{ fontSize: "0.78rem", color: S.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {ex.sets}×{ex.reps.includes("sec") ? "Max hold" : ex.reps}
      </span>
    </div>
  );
}

function ExerciseSection({ label, labelColor, exercises }: { label: string; labelColor: string; exercises: Exercise[] }) {
  if (exercises.length === 0) return null;
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <p style={{ margin: "0 0 0", fontSize: "0.63rem", letterSpacing: "0.07em", textTransform: "uppercase", color: labelColor, paddingTop: "0.5rem", paddingBottom: "0.1rem", borderTop: `1px solid ${S.border}` }}>
        {label}
      </p>
      {exercises.map((ex, i) => (
        <ExerciseRow key={i} ex={ex} last={i === exercises.length - 1} />
      ))}
    </div>
  );
}
