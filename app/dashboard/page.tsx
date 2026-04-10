import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";
import type { WeeklyPlan, Level, Goal } from "@/types";
import DashboardClient from "./DashboardClient";

const S = {
  bg: "#0f0f0e",
  surface: "#1a1a18",
  border: "#2e2e2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  muscle: "#c8f04a",
};

function getWeekNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) return null;

  const profile = await getOrLinkProfile(user);

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

  // Load saved plan from Supabase — no AI call on page load
  const { data: savedPlan } = await supabaseAdmin
    .from("user_plans")
    .select("plan, week_number")
    .eq("user_id", profile.id)
    .single();

  const week = getWeekNumber(profile.created_at);

  // Only show the saved plan if it belongs to the current week.
  // If the week has rolled over, treat it as no plan so the user gets a fresh empty state.
  const planIsCurrent = savedPlan?.week_number === week;
  const initialPlan = (planIsCurrent ? savedPlan?.plan : null) as WeeklyPlan | null;

  return (
    <DashboardClient
      initialPlan={initialPlan}
      firstName={user.firstName ?? null}
      week={week}
      level={profile.level as Level}
      goal={profile.goal as Goal}
    />
  );
}
