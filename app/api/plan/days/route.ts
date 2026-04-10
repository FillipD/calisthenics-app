import { NextResponse }    from "next/server";
import { currentUser }     from "@clerk/nextjs/server";
import { supabaseAdmin }   from "@/lib/supabase";
import type { TrainingDay } from "@/types";

// PATCH /api/plan/days
// Saves a reordered days array back into the user's existing plan row.
// Only the days array is replaced; the plan's coaching note and week_number are
// preserved. Called after drag-and-drop rearrangement on the dashboard.

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let body: { days: TrainingDay[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { days } = body;
  if (!Array.isArray(days) || days.length !== 7) {
    return NextResponse.json({ error: "days must be an array of 7" }, { status: 400 });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", profile.id)
    .single();

  if (!planRow) return NextResponse.json({ error: "No plan found" }, { status: 404 });

  const updatedPlan = { ...(planRow.plan as object), days };

  const { error } = await supabaseAdmin
    .from("user_plans")
    .update({ plan: updatedPlan })
    .eq("user_id", profile.id);

  if (error) {
    console.error("[PATCH /api/plan/days]", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
