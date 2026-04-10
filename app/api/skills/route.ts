import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { NODE_MAP, findNextSkillStep, findBestSkillStep } from "@/lib/skillTree";
import { terminalNodeIdToGoalId, goalIdToTerminalNodeId } from "@/lib/proOnboarding";
import type { ProGoalId } from "@/types";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { skillName, category } = await req.json();

  if (!skillName || !category) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // skillName is a terminal node id from the client (e.g. "strict-mu").
  // Store the canonical goal id when available (e.g. "muscle-up"), fall back to node id.
  const storedName = terminalNodeIdToGoalId(skillName) ?? skillName;

  // Find the user's best starting step based on their existing skill tree progress
  const { data: progressData } = await supabaseAdmin
    .from("user_progress")
    .select("node_id, status")
    .eq("user_id", profile.id);

  const progressMap: Record<string, string> = {};
  for (const p of (progressData ?? [])) progressMap[p.node_id] = p.status;

  const bestStep = findBestSkillStep(skillName, progressMap);

  // Check if this skill already exists (query by stored name)
  const { data: existing } = await supabaseAdmin
    .from("user_skills")
    .select("id")
    .eq("user_id", profile.id)
    .eq("skill_name", storedName)
    .single();

  if (!existing) {
    // Check per-category limit: max 1 active goal per category
    const { data: currentSkills } = await supabaseAdmin
      .from("user_skills")
      .select("skill_name")
      .eq("user_id", profile.id);

    const sameCategoryGoal = (currentSkills ?? []).find((s) => {
      // skill_name may be a ProGoalId or a terminal node id — resolve to terminal for NODE_MAP lookup
      const terminalId = goalIdToTerminalNodeId(s.skill_name as ProGoalId) ?? s.skill_name;
      const node = NODE_MAP.get(terminalId);
      return node?.category === category;
    });

    if (sameCategoryGoal) {
      const terminalId  = goalIdToTerminalNodeId(sameCategoryGoal.skill_name as ProGoalId) ?? sameCategoryGoal.skill_name;
      const existingNode = NODE_MAP.get(terminalId);
      return NextResponse.json(
        { error: `You already have a ${category} skill goal (${existingNode?.name ?? sameCategoryGoal.skill_name}). Remove it first.` },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("user_skills").insert({
      user_id: profile.id,
      skill_name: storedName,
      current_progression: bestStep,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Goal already exists — update progression to match current skill tree position
    const { error } = await supabaseAdmin
      .from("user_skills")
      .update({ current_progression: bestStep })
      .eq("user_id", profile.id)
      .eq("skill_name", storedName);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, currentProgression: bestStep });
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { skillName } = await req.json();
  if (!skillName) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const storedName = terminalNodeIdToGoalId(skillName) ?? skillName;

  const { data: skill } = await supabaseAdmin
    .from("user_skills")
    .select("current_progression")
    .eq("user_id", profile.id)
    .eq("skill_name", storedName)
    .single();
  if (!skill) return NextResponse.json({ error: "Skill goal not found" }, { status: 404 });

  const nextStep = findNextSkillStep(skill.current_progression);
  if (!nextStep) return NextResponse.json({ error: "Already at final goal" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("user_skills")
    .update({ current_progression: nextStep })
    .eq("user_id", profile.id)
    .eq("skill_name", storedName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, nextProgression: nextStep });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { skillName } = await req.json();
  if (!skillName) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const storedName = terminalNodeIdToGoalId(skillName) ?? skillName;

  const { error } = await supabaseAdmin
    .from("user_skills")
    .delete()
    .eq("user_id", profile.id)
    .eq("skill_name", storedName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
