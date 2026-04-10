import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import type { WeeklyPlan } from "@/types";
import LogForm from "./LogForm";

function getWeekNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;

  if (!day) redirect("/dashboard");

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) redirect("/start");

  // Load plan from user_plans — no AI call
  const { data: savedPlan } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", profile.id)
    .single();

  if (!savedPlan) redirect("/dashboard");

  const plan = savedPlan.plan as WeeklyPlan;

  const trainingDay = plan.days.find(
    (d) => d.day.toLowerCase() === day.toLowerCase()
  );

  if (!trainingDay || trainingDay.type === "rest") redirect("/dashboard");

  const week_number = getWeekNumber(profile.created_at);

  const { data: existingLogs } = await supabaseAdmin
    .from("weekly_logs")
    .select("exercise_name, sets_completed, reps_completed")
    .eq("user_id", profile.id)
    .eq("week_number", week_number)
    .eq("day_label", trainingDay.day);

  return (
    <LogForm
      day={trainingDay.day}
      focus={trainingDay.focus!}
      exercises={trainingDay.exercises!}
      skillWork={trainingDay.skillWork ?? []}
      existingLogs={existingLogs ?? []}
    />
  );
}
