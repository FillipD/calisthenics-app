// lib/skillProgress.ts
// Server-side Supabase helpers for skill tree data fetching.
// Import only from server components (page.tsx, route handlers).

import { supabaseAdmin } from "@/lib/supabase";
import { goalIdToTerminalNodeId } from "@/lib/proOnboarding";
import type { ProgressStatus, ProGoalId } from "@/types";

export async function fetchUserSkills(profileId: string): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("user_skills")
    .select("skill_name, current_progression")
    .eq("user_id", profileId);
  const result: Record<string, string> = {};
  for (const s of data ?? []) {
    // skill_name is stored as a ProGoalId (e.g. "muscle-up") for the 7 known goals,
    // or as a terminal node id for unmapped goals. Convert back to terminal node id
    // so callers always work in terminal-node-id space (as SkillTree expects).
    const key = goalIdToTerminalNodeId(s.skill_name as ProGoalId) ?? s.skill_name;
    result[key] = s.current_progression;
  }
  return result;
}

export async function fetchUserProgress(profileId: string): Promise<Record<string, ProgressStatus>> {
  const { data } = await supabaseAdmin
    .from("user_progress")
    .select("node_id, status")
    .eq("user_id", profileId);
  const result: Record<string, ProgressStatus> = {};
  for (const p of data ?? []) result[p.node_id] = p.status as ProgressStatus;
  return result;
}
