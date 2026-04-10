import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePlanFromProfile, ProPlanGenerationError } from "@/lib/generatePlanAI";
import type { WeeklyPlan } from "@/types";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const weekNumber = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : 1;

  // Fetch all context in parallel — savedPlan fetched separately before this call
  const [
    { data: skillGoalsData },
    { data: userProgressData },
    { data: recentLogsData },
    { data: savedPlanRow },
  ] = await Promise.all([
    supabaseAdmin
      .from("user_skills")
      .select("skill_name, current_progression")
      .eq("user_id", profile.id),
    supabaseAdmin
      .from("user_progress")
      .select("node_id, status")
      .eq("user_id", profile.id),
    supabaseAdmin
      .from("weekly_logs")
      .select("week_number, day_label, exercise_name, sets_completed, reps_completed, sets_data")
      .eq("user_id", profile.id)
      .gte("week_number", Math.max(1, weekNumber - 2)) // last 2 weeks
      .order("week_number", { ascending: false }),
    supabaseAdmin
      .from("user_plans")
      .select("plan")
      .eq("user_id", profile.id)
      .single(),
  ]);

  // The saved plan is the previous week's plan — used as prescription reference
  // for performance evaluation. Fetched before the upsert so it reflects last week.
  const previousPlan = (savedPlanRow?.plan ?? null) as WeeklyPlan | null;

  let plan;
  try {
    plan = await generatePlanFromProfile(
      profile,
      skillGoalsData ?? [],
      userProgressData ?? [],
      recentLogsData ?? [],
      previousPlan,
    );
  } catch (err) {
    if (err instanceof ProPlanGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[/api/plan/generate] Unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  await supabaseAdmin.from("user_plans").upsert(
    { user_id: profile.id, plan, week_number: weekNumber, generated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ plan, generatedAt: new Date().toISOString() });
}
