import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Auth required, no subscription check.
//   - /api/stripe/checkout creates a NEW subscription (free users must reach it)
//   - /api/stripe/portal manages an EXISTING subscription (recently-canceled
//     users in their grace period must be able to reach it to update billing
//     or reactivate, even if their pro status is technically lapsing)
const isAuthOnly = createRouteMatcher([
  "/api/stripe/checkout",
  "/api/stripe/portal",
]);

// Auth + active subscription required.
//
// Pages: rendering UI for pro-only areas.
// APIs:  server-side endpoints that read/write pro-only data or trigger paid
//        operations (AI plan generation). These MUST be protected here so a
//        signed-in free user cannot call them directly with curl / fetch.
//
// Intentionally NOT protected here:
//   - /api/stripe/checkout   → auth-only, free users must be able to start checkout
//   - /api/stripe/webhook    → no auth (Stripe signs the request)
//   - /api/subscribe         → free /start flow, no auth required
//   - /api/dev/*             → gated by NODE_ENV in the route handler
const isSubscriptionProtected = createRouteMatcher([
  // Pages
  "/dashboard(.*)",
  "/log(.*)",
  "/skills(.*)",
  "/progress(.*)",
  "/settings(.*)",
  "/workout(.*)",
  // APIs
  "/api/plan/(.*)",
  "/api/skills(.*)",
  "/api/log(.*)",
  "/api/progress(.*)",
  "/api/settings(.*)",
  "/api/onboarding/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isAuthOnly(req)) {
    await auth.protect();
    return;
  }

  if (isSubscriptionProtected(req)) {
    const { userId } = await auth();
    const isApi = req.nextUrl.pathname.startsWith("/api/");

    if (!userId) {
      if (isApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("clerk_id", userId)
      .single();

    if (!profile || profile.subscription_status !== "pro") {
      if (isApi) {
        return NextResponse.json({ error: "Subscription required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/pricing", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
