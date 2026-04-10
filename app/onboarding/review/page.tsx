// app/onboarding/review/page.tsx — server wrapper
//
// Guards (in order):
//   1. Not signed in → /sign-in
//   2. No profile    → /start  (complete basic onboarding first)
//
// Session data check (no sessionStorage content) is handled client-side
// by <ProOnboardingReview /> which redirects to /onboarding/pro if empty.

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import ProOnboardingReview from "./ProOnboardingReview";

export default async function ProOnboardingReviewPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clerk_id", user.id)
    .single();
  if (!profile) redirect("/start");

  return <ProOnboardingReview />;
}
