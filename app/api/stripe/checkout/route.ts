import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId } = await req.json();

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  // Find profile by clerk_id, fall back to email, create if needed
  let { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, stripe_customer_id, subscription_status")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    const { data: byEmail } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id, subscription_status")
      .eq("email", email)
      .single();

    if (byEmail) {
      await supabaseAdmin
        .from("profiles")
        .update({ clerk_id: userId })
        .eq("email", email);
      profile = byEmail;
    } else {
      const { data: created } = await supabaseAdmin
        .from("profiles")
        .insert({ email, clerk_id: userId, goal: "build-strength", level: "Beginner" })
        .select("id, stripe_customer_id, subscription_status")
        .single();
      profile = created;
    }
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile error" }, { status: 500 });
  }

  // Belt-and-braces guard: if the profile is already pro, do NOT create a
  // second Stripe subscription. The pricing page redirects pro users away
  // server-side, but this protects against direct API calls, stale tabs, and
  // any path that bypasses the UI guard.
  if (profile.subscription_status === "pro") {
    return NextResponse.json(
      { error: "Already subscribed", redirectTo: "/dashboard" },
      { status: 409 },
    );
  }

  // Create or reuse Stripe customer
  let customerId = profile.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", profile.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Success lands on a dedicated verification page that confirms the
    // session directly with Stripe and promotes the profile to pro BEFORE
    // the webhook necessarily lands. This removes the race where a paying
    // user could be bounced back to /pricing because middleware saw stale
    // subscription_status. {CHECKOUT_SESSION_ID} is a literal Stripe token —
    // Stripe substitutes the real session id in the redirect URL.
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
    // clerkUserId is stashed on the session so /checkout/success can verify
    // that the returned session_id actually belongs to the signed-in user.
    // Without this check, a signed-in free user could pass somebody else's
    // session_id and get promoted.
    metadata: { clerkUserId: userId },
  });

  return NextResponse.json({ url: session.url });
}
