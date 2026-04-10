// lib/analytics.ts
//
// Thin, type-safe wrapper around posthog-js for product analytics.
//
// Why a wrapper:
//   - One place to enforce event names (the union below — typo-proof)
//   - Fail-safe: never throws or breaks the app if PostHog isn't configured
//     or fails for any reason. Analytics must be invisible when broken.
//   - Single import path so we can swap providers later without touching call sites.
//
// PostHog identification (associating events with a user) is handled by
// PostHogProvider in components/PostHogProvider.tsx — call sites just track().

import posthog from "posthog-js";

export type EventName =
  // Core funnel — pricing → checkout → onboarding → first plan → first workout
  | "pricing_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "onboarding_started"
  | "onboarding_completed"
  | "first_plan_generated"
  | "workout_started"
  | "workout_completed"
  // Supporting / optional
  | "generate_plan_clicked"
  | "generate_plan_failed"
  | "workout_swap_used";

export function track(event: EventName, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch (err) {
    // Never block the app on analytics failures. Log so issues are visible
    // in dev/console without surfacing to the user.
    console.warn("[analytics] capture failed:", err);
  }
}
