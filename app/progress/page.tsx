import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

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

interface LogRow {
  week_number: number;
  day_label: string;
  exercise_name: string;
  sets_completed: number;
  reps_completed: number;
}

export default async function ProgressPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) redirect("/start");

  const { data: logs } = await supabaseAdmin
    .from("weekly_logs")
    .select("week_number, day_label, exercise_name, sets_completed, reps_completed")
    .eq("user_id", profile.id)
    .order("week_number", { ascending: false })
    .order("day_label", { ascending: true });

  const allLogs: LogRow[] = logs ?? [];

  // Group: week → day → exercises (deduplicate by exercise_name, last write wins)
  const byWeek = new Map<number, Map<string, Map<string, LogRow>>>();
  for (const row of allLogs) {
    if (!byWeek.has(row.week_number)) byWeek.set(row.week_number, new Map());
    const byDay = byWeek.get(row.week_number)!;
    if (!byDay.has(row.day_label)) byDay.set(row.day_label, new Map());
    byDay.get(row.day_label)!.set(row.exercise_name, row);
  }

  const totalWorkouts = Array.from(byWeek.values()).reduce((acc, byDay) => acc + byDay.size, 0);

  const currentWeek = getWeekNumber(profile.created_at);

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
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Progress
          </h1>
          <p style={{ margin: 0, fontSize: "0.875rem", color: S.muted }}>
            Your workout history
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem", marginBottom: "2rem" }}>
          <StatCard label="Workouts" value={String(totalWorkouts)} />
          <StatCard label="Week" value={String(currentWeek)} />
          <StatCard label="Level" value={profile.level} />
        </div>

        {/* Log history */}
        {byWeek.size === 0 ? (
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", padding: "2rem 1.25rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: S.mutedLight }}>No workouts logged yet.</p>
            <p style={{ margin: 0, fontSize: "0.85rem", color: S.muted }}>
              Head to your <Link href="/dashboard" style={{ color: S.muscle, textDecoration: "none" }}>dashboard</Link> and hit &ldquo;Log workout&rdquo; after a session.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {Array.from(byWeek.entries()).map(([week, byDay]) => (
              <div key={week}>
                {/* Week heading */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muscle }}>
                    Week {week}
                  </span>
                  <div style={{ flex: 1, height: "1px", background: S.border }} />
                  <span style={{ fontSize: "0.7rem", color: S.muted }}>
                    {byDay.size} {byDay.size === 1 ? "session" : "sessions"}
                  </span>
                </div>

                {/* Days in this week */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Array.from(byDay.entries()).map(([day, exerciseMap]) => {
                    const exercises = Array.from(exerciseMap.values());
                    return (
                      <div
                        key={day}
                        style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "8px", overflow: "hidden" }}
                      >
                        {/* Day header */}
                        <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${S.border}` }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: S.white, letterSpacing: "0.02em" }}>
                            {day}
                          </span>
                        </div>

                        {/* Exercises */}
                        <div style={{ padding: "0.25rem 1.25rem" }}>
                          {/* Column headers */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px", gap: "0.5rem", padding: "0.55rem 0", borderBottom: `1px solid ${S.border}` }}>
                            {["Exercise", "Sets", "Reps"].map((h, i) => (
                              <span
                                key={h}
                                style={{ fontSize: "0.65rem", letterSpacing: "0.06em", textTransform: "uppercase", color: S.muted, textAlign: i === 0 ? "left" : "right" }}
                              >
                                {h}
                              </span>
                            ))}
                          </div>

                          {exercises.map((ex, i) => (
                            <div
                              key={i}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 64px 64px",
                                gap: "0.5rem",
                                padding: "0.6rem 0",
                                borderBottom: i < exercises.length - 1 ? `1px solid ${S.border}` : "none",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ fontSize: "0.85rem", color: S.white }}>{ex.exercise_name}</span>
                              <span style={{ fontSize: "0.85rem", color: S.mutedLight, textAlign: "right" }}>{ex.sets_completed}</span>
                              <span style={{ fontSize: "0.85rem", color: S.mutedLight, textAlign: "right" }}>
                                {ex.reps_completed > 0 ? ex.reps_completed : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: "8px",
        padding: "1rem 1.25rem",
      }}
    >
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: S.white, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}
