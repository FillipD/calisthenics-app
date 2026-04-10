import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchUserSkills, fetchUserProgress } from "@/lib/skillProgress";
import SkillTreePage from "./SkillTreePage";

export default async function SkillsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  if (!profile) redirect("/start");

  const [initialSkills, initialProgress] = await Promise.all([
    fetchUserSkills(profile.id),
    fetchUserProgress(profile.id),
  ]);

  return (
    <SkillTreePage
      initialSkills={initialSkills}
      initialProgress={initialProgress}
    />
  );
}
