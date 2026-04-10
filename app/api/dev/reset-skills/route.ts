// app/api/dev/reset-skills/route.ts
//
// Dev-only route. Wipes user_skills and user_progress for the current user so
// pro onboarding can be re-run from scratch.
//
// Gated by NODE_ENV !== "production" — returns 403 in production regardless of payload.
// Requires { confirm: true } in the POST body to prevent accidental calls.
//
// Usage (from browser console or curl):
//   fetch('/api/dev/reset-skills', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ confirm: true }),
//   }).then(r => r.json()).then(console.log)
//
// After calling this, navigate to /onboarding/pro?reset=1 to re-run onboarding.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.confirm) {
    return NextResponse.json(
      { error: 'Pass { "confirm": true } to proceed — this deletes your saved skill state' },
      { status: 400 },
    );
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabaseAdmin.from("user_skills").delete().eq("user_id", profile.id),
    supabaseAdmin.from("user_progress").delete().eq("user_id", profile.id),
  ]);

  if (e1 || e2) {
    return NextResponse.json({ error: e1?.message ?? e2?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Skill state cleared. Navigate to /onboarding/pro?reset=1 to re-run onboarding.",
  });
}
