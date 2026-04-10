// app/checkout/success/page.tsx
//
// Post-checkout verification page.
//
// Stripe redirects here after a successful payment with ?session_id={id}.
// This page retrieves the checkout session directly from the Stripe API and,
// if it verifies clean, marks the profile as pro synchronously — BEFORE the
// async webhook write has necessarily landed. This eliminates the race where
// a paying user would otherwise be bounced from /dashboard back to /pricing
// because middleware saw the stale "free" status.
//
// The webhook remains the long-term source of truth for subscription
// lifecycle (renewal, cancellation, payment failures). This page only owns
// the immediate post-payment handoff for the first transaction.
//
// Security model — a session_id is accepted only if ALL of:
//   1. The session exists in Stripe and is fully complete + paid.
//   2. The session's metadata.clerkUserId matches the currently signed-in
//      Clerk user id. Without this, a signed-in free user could paste
//      somebody else's session_id and get promoted.
//   3. The profile for that Clerk user can be resolved in Supabase.
//
// If any verification step fails, the user is redirected to /pricing with
// an error flag and nothing in the database is mutated.

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  // ── 1. Auth ────────────────────────────────────────────────────────────
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/pricing");

  // ── 2. Retrieve session from Stripe (authoritative answer) ─────────────
  const session = await stripe.checkout.sessions
    .retrieve(sessionId)
    .catch((err) => {
      console.error("[/checkout/success] stripe.retrieve failed:", err);
      return null;
    });

  if (!session) {
    redirect("/pricing?error=verification_failed");
  }

  // ── 3. Verify session ──────────────────────────────────────────────────
  const isComplete = session.status === "complete";
  const isPaid     = session.payment_status === "paid";
  const ownerMatch = session.metadata?.clerkUserId === user.id;

  if (!isComplete || !isPaid || !ownerMatch) {
    console.warn("[/checkout/success] Verification failed", {
      userId: user.id,
      sessionId,
      status: session.status,
      paymentStatus: session.payment_status,
      ownerMatch,
    });
    redirect("/pricing?error=verification_failed");
  }

  // ── 4. Resolve profile ─────────────────────────────────────────────────
  const profile = await getOrLinkProfile(user);
  if (!profile) {
    console.error("[/checkout/success] No profile found for verified user", user.id);
    redirect("/pricing?error=verification_failed");
  }

  // ── 5. Promote to pro synchronously ────────────────────────────────────
  // Mirrors the webhook's `checkout.session.completed` handler. Idempotent:
  // if the webhook has already written these fields, this is a no-op; if
  // not, this eliminates the race against middleware on the very next
  // navigation.
  const customerId     = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: "pro",
      ...(customerId     ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("id", profile.id);

  if (updateError) {
    // We don't block the user — the webhook is still the long-term backstop
    // and their Stripe subscription definitely exists. Worst case they may
    // briefly see /pricing after landing on /dashboard if middleware runs
    // before the webhook lands. Log so we can catch this in monitoring.
    console.error("[/checkout/success] Profile update failed:", updateError);
  }

  // ── 6. Route to the correct next step ──────────────────────────────────
  //   - No user_skills yet  → first-time pro user, send to onboarding
  //   - Already onboarded   → dashboard (with ?success=true welcome banner)
  const { data: skills } = await supabaseAdmin
    .from("user_skills")
    .select("id")
    .eq("user_id", profile.id)
    .limit(1);

  // The `?checkout=success` query param is read by DashboardClient and
  // ProOnboardingFormV2 to fire the `checkout_completed` analytics event
  // exactly once on first mount after a successful payment.
  if (skills && skills.length > 0) {
    redirect("/dashboard?success=true&checkout=success");
  }
  redirect("/onboarding/pro?checkout=success");
}
