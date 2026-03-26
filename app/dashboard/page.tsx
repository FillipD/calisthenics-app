import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePlan } from "@/lib/plan";
import type { Level, Goal, TrainingDay } from "@/types";

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

function getWeekNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) return null;

  // Try to find profile by clerk_id first
  let { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  // If not found, try linking by email (user came through /start before signing up)
  if (!profile) {
    const email = user.emailAddresses[0]?.emailAddress;
    if (email) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", email)
        .single();

      if (profileByEmail) {
        // Link the Clerk ID to this profile
        await supabaseAdmin
          .from("profiles")
          .update({ clerk_id: user.id })
          .eq("email", email);
        profile = { ...profileByEmail, clerk_id: user.id };
      }
    }
  }

  // No profile yet — prompt to complete onboarding
  if (!profile) {
    return (
      <main style={{ minHeight: "100dvh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.75rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
          No plan yet
        </h1>
        <p style={{ margin: "0 0 2rem", fontSize: "0.95rem", color: S.muted, lineHeight: 1.6, maxWidth: "320px" }}>
          Complete the free assessment to get your personalised training plan.
        </p>
        <Link
          href="/start"
          style={{ background: S.muscle, color: "#0f0f0e", padding: "0.85rem 1.75rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none", letterSpacing: "-0.01em" }}
        >
          Get my free plan →
        </Link>
      </main>
    );
  }

  const level = profile.level as Level;
  const goal = profile.goal as Goal;
  const week = getWeekNumber(profile.created_at);
  const plan = generatePlan(level, goal);
  const firstName = user.firstName ?? "there";

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
            Week {week}
          </p>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {firstName}
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: S.muted }}>
            {level} · {goal.replace(/-/g, " ")}
          </p>
        </div>

        {/* Coaching note */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderLeft: `3px solid ${S.muscle}`, borderRadius: "8px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muscle }}>
            Coaching note
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: S.mutedLight, lineHeight: 1.6 }}>
            {plan.note}
          </p>
        </div>

        {/* Days */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {plan.days.map((day) => (
            <DayCard key={day.day} day={day} />
          ))}
        </div>

      </div>
    </main>
  );
}

function DayCard({ day }: { day: TrainingDay }) {
  if (day.type === "rest") {
    return (
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.5 }}>
        <span style={{ fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted }}>{day.day}</span>
        <span style={{ fontSize: "0.8rem", color: S.muted }}>Rest</span>
      </div>
    );
  }

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", overflow: "hidden" }}>
      {/* Day header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${S.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.rust }}>{day.day}</p>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: S.white }}>{day.focus}</p>
        </div>
        <Link
          href={`/log?day=${day.day}`}
          style={{ background: S.surfaceHigh, border: `1px solid ${S.border}`, color: S.mutedLight, padding: "0.4rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}
        >
          Log workout
        </Link>
      </div>

      {/* Exercises */}
      <div style={{ padding: "0.25rem 1.25rem" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 80px", gap: "0.5rem", padding: "0.6rem 0", borderBottom: `1px solid ${S.border}` }}>
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted }}>Exercise</span>
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "center" }}>Sets</span>
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: "right" }}>Reps</span>
        </div>
        {(day.exercises ?? []).map((ex, i) => (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "1fr 48px 80px", gap: "0.5rem", padding: "0.65rem 0", borderBottom: i < (day.exercises?.length ?? 0) - 1 ? `1px solid ${S.border}` : "none", alignItems: "center" }}
          >
            <span style={{ fontSize: "0.875rem", color: S.white }}>{ex.name}</span>
            <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "center" }}>{ex.sets}</span>
            <span style={{ fontSize: "0.875rem", color: S.muted, textAlign: "right" }}>{ex.reps}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
