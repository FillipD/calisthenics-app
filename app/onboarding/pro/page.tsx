// app/onboarding/pro/page.tsx — server wrapper
//
// Guards (in order):
//   1. Not signed in     → /sign-in
//   2. No profile        → /start  (complete basic onboarding first)
//   3. Already onboarded → /skills (user_skills rows already exist)
//
// If all pass, renders the client-side <ProOnboardingForm />.
//
// Dev only: append ?reset=1 to bypass guard 3 without touching the database.
// To also wipe saved skill state, POST to /api/dev/reset-skills first.

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import ProOnboardingFormV2 from "./ProOnboardingFormV2";

export default async function ProOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  if (!profile) redirect("/start");

  const params    = await searchParams;
  const resetMode = process.env.NODE_ENV !== "production" && params.reset === "1";

  if (!resetMode) {
    const { data: skills } = await supabaseAdmin
      .from("user_skills")
      .select("id")
      .eq("user_id", profile.id)
      .limit(1);
    if (skills && skills.length > 0) redirect("/skills");
  }

  return <ProOnboardingFormV2 resetMode={resetMode} />;
}
