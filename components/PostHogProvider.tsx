"use client";

// components/PostHogProvider.tsx
//
// Initializes posthog-js once on mount, identifies the user when they sign in
// (Clerk → PostHog distinct_id), and emits a $pageview event on every Next.js
// route change. Renders nothing — drop into the root layout above {children}.
//
// Behavior with no env config:
//   If NEXT_PUBLIC_POSTHOG_KEY is missing, init becomes a no-op and every
//   track() call falls through silently. The app runs unchanged.
//
// EU cloud is the default host (eu.i.posthog.com) since CaliPlan is operated
// from Denmark and we want to keep user data in the EU. Override with
// NEXT_PUBLIC_POSTHOG_HOST if needed.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key) return; // not configured — analytics is a silent no-op

  posthog.init(key, {
    api_host:        host,
    capture_pageview: false, // we capture manually on pathname change below
    autocapture:      false, // explicit events only — no DOM-scraping noise
    persistence:      "localStorage",
  });

  initialized = true;
}

export default function PostHogProvider() {
  const { user, isSignedIn } = useUser();
  const pathname = usePathname();

  // Init once on first mount
  useEffect(() => {
    ensureInit();
  }, []);

  // Identify (on sign-in) or reset (on sign-out)
  useEffect(() => {
    if (!initialized) return;
    if (isSignedIn && user?.id) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress ?? undefined,
      });
    } else if (isSignedIn === false) {
      posthog.reset();
    }
  }, [isSignedIn, user?.id, user?.primaryEmailAddress?.emailAddress]);

  // Pageview on every Next.js route change
  useEffect(() => {
    if (!initialized || typeof window === "undefined") return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
