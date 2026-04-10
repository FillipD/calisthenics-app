import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

function getWeekNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { day, exercises } = await req.json();

  if (!day || !Array.isArray(exercises)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const week_number = getWeekNumber(profile.created_at);

  // Delete existing rows for this day/week before inserting
  const { error: deleteError } = await supabaseAdmin
    .from("weekly_logs")
    .delete()
    .eq("user_id", profile.id)
    .eq("week_number", week_number)
    .eq("day_label", day);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const rows = exercises.map((ex: { name: string; setsCompleted: number; repsCompleted: number; sets_data?: unknown }) => ({
    user_id: profile.id,
    week_number,
    day_label: day,
    exercise_name: ex.name,
    sets_completed: ex.setsCompleted,
    reps_completed: ex.repsCompleted,
    ...(ex.sets_data !== undefined ? { sets_data: ex.sets_data } : {}),
  }));

  const { error } = await supabaseAdmin.from("weekly_logs").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
