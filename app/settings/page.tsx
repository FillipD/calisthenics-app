import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import type { Goal } from "@/types";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("goal, days_per_week, equipment")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) redirect("/start");

  return (
    <SettingsForm
      initialGoal={(profile.goal as Goal) ?? "build-strength"}
      initialDaysPerWeek={profile.days_per_week ?? 3}
      initialEquipment={profile.equipment ?? []}
    />
  );
}
