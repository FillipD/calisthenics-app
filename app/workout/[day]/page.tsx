import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import WorkoutClient from "./WorkoutClient";
import type { TrainingDay } from "@/types";

export default async function WorkoutPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", profile.id)
    .single();

  const plan = planRow?.plan ?? null;
  const dayName = decodeURIComponent(day);
  const dayData: TrainingDay | null =
    plan?.days?.find((d: TrainingDay) => d.day.toLowerCase() === dayName.toLowerCase()) ?? null;

  if (!dayData || dayData.type === "rest") redirect("/dashboard");

  return <WorkoutClient day={dayData} />;
}
