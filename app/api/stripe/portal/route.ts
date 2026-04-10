// app/api/stripe/portal/route.ts
//
// Creates a Stripe Billing Portal session for the signed-in user and returns
// the portal URL. The frontend redirects the browser there. Inside the portal
// the user can cancel their subscription, update payment method, view
// invoices, etc. — all hosted by Stripe.
//
// The cancellation behavior (immediate vs at-period-end) is configured in the
// Stripe Dashboard at https://dashboard.stripe.com/settings/billing/portal,
// not here. We use "at end of billing period" so users keep access until the
// time they've already paid for.
//
// The webhook handler at /api/stripe/webhook is the source of truth for
// subscription state changes that result from portal actions (cancellation
// fires customer.subscription.deleted, etc.) — no DB writes happen here.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No subscription found. Subscribe first to manage billing." },
      { status: 404 },
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/portal] Failed to create portal session:", err);
    return NextResponse.json(
      { error: "Could not open subscription portal. Please try again." },
      { status: 500 },
    );
  }
}
