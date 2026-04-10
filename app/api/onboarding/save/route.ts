// app/api/onboarding/save/route.ts
//
// Bulk saves the onboarding-reviewed skill tree state for a pro user.
// Used exclusively by the /onboarding/review page on first-time pro setup.
//
// This route is intentionally different from /api/progress and /api/skills:
//   - Those routes are designed for interactive one-node-at-a-time toggling.
//   - This route writes the entire assessed + reviewed state in one operation
//     (delete previous, insert reviewed), which is what onboarding requires.
//   - The 1-goal-per-category limit in /api/skills is not enforced here because
//     the user explicitly chose multiple goals during onboarding.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { terminalNodeIdToGoalId } from "@/lib/proOnboarding";
import type { ProgressStatus } from "@/types";

interface ProgressEntry {
  nodeId: string;
  status: ProgressStatus;
}

interface GoalEntry {
  skillName:           string;
  currentProgression:  string;
}

interface ProfileFields {
  daysPerWeek?:  number;
  equipment?:    string[];
  /** TrainingEmphasis value — mapped to Goal before writing */
  emphasis?:     string;
  sessionLength?: string;
}

interface SavePayload {
  progress:      ProgressEntry[];
  goals:         GoalEntry[];
  profileFields?: ProfileFields;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json() as SavePayload;

  if (!Array.isArray(body.progress) || !Array.isArray(body.goals)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ── Profile fields (schedule preferences collected during onboarding) ────────
  if (body.profileFields) {
    const pf = body.profileFields;
    const profileUpdate: Record<string, unknown> = {};

    if (typeof pf.daysPerWeek === "number") profileUpdate.days_per_week = pf.daysPerWeek;
    if (Array.isArray(pf.equipment))        profileUpdate.equipment     = pf.equipment;
    if (typeof pf.sessionLength === "string") profileUpdate.session_length = pf.sessionLength;

    // Map TrainingEmphasis → Goal
    if (pf.emphasis === "strength")       profileUpdate.goal = "build-strength";
    else if (pf.emphasis === "muscle")    profileUpdate.goal = "build-muscle";
    else if (pf.emphasis === "balanced")  profileUpdate.goal = "build-strength-muscle";

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", profile.id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }
  }

  // ── Progress: clean slate then bulk insert ───────────────────────────────
  // Wipe existing progress so the reviewed state is the authoritative source.
  const { error: deleteProgressError } = await supabaseAdmin
    .from("user_progress")
    .delete()
    .eq("user_id", profile.id);

  if (deleteProgressError) {
    return NextResponse.json({ error: deleteProgressError.message }, { status: 500 });
  }

  if (body.progress.length > 0) {
    const progressRows = body.progress.map(({ nodeId, status }) => ({
      user_id: profile.id,
      node_id: nodeId,
      status,
    }));

    const { error: insertProgressError } = await supabaseAdmin
      .from("user_progress")
      .insert(progressRows);

    if (insertProgressError) {
      return NextResponse.json({ error: insertProgressError.message }, { status: 500 });
    }
  }

  // ── Skills / goals: clean slate then bulk insert ─────────────────────────
  const { error: deleteSkillsError } = await supabaseAdmin
    .from("user_skills")
    .delete()
    .eq("user_id", profile.id);

  if (deleteSkillsError) {
    return NextResponse.json({ error: deleteSkillsError.message }, { status: 500 });
  }

  if (body.goals.length > 0) {
    const skillRows = body.goals.map(({ skillName, currentProgression }) => ({
      user_id:             profile.id,
      // skillName is a terminal node id from activeSkills keys (e.g. "strict-mu").
      // Store the canonical goal id when available (e.g. "muscle-up").
      skill_name:          terminalNodeIdToGoalId(skillName) ?? skillName,
      current_progression: currentProgression,
    }));

    const { error: insertSkillsError } = await supabaseAdmin
      .from("user_skills")
      .insert(skillRows);

    if (insertSkillsError) {
      return NextResponse.json({ error: insertSkillsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
