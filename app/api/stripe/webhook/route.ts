import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerkUserId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (clerkUserId) {
        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "pro",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("clerk_id", clerkUserId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("profiles")
        .update({ subscription_status: "free", stripe_subscription_id: null })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;

      // Explicit allow-list of statuses that keep pro access.
      //
      //   active    → normal paid state
      //   trialing  → user is in a trial period (keep access during trial)
      //   past_due  → renewal payment failed, Stripe is retrying. Standard
      //               grace period is ~3 weeks. Cutting users off on day 1
      //               of a temporary card decline is bad UX and wrong — if
      //               retries ultimately fail, Stripe moves the subscription
      //               to `unpaid` (or `canceled`), both of which demote below.
      //
      // Everything else demotes to free:
      //   canceled, unpaid, incomplete, incomplete_expired, paused
      //
      // Hard cancellations are also handled by the separate
      // customer.subscription.deleted branch as belt-and-braces.
      const PRO_STATUSES: Stripe.Subscription.Status[] = [
        "active",
        "trialing",
        "past_due",
      ];
      const newStatus = PRO_STATUSES.includes(subscription.status) ? "pro" : "free";

      await supabaseAdmin
        .from("profiles")
        .update({ subscription_status: newStatus })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
