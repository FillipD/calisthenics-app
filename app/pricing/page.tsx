import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";
import PricingCards, { type UserContext } from "./PricingCards";
import type { Goal, Level } from "@/types";

// Accepted values from the free assessment. Used to sanity-check query-param
// fallbacks so malformed or tampered URLs don't trigger weird hero copy.
const VALID_LEVELS: Level[] = ["Beginner", "Beginner+", "Intermediate", "Advanced"];
const VALID_GOALS:  Goal[]  = ["build-strength", "build-muscle", "build-strength-muscle"];

interface PageProps {
  searchParams: Promise<{ level?: string; goal?: string }>;
}

export default async function PricingPage({ searchParams }: PageProps) {
  // Pro users should never see this page — bounce them to the dashboard so
  // they can't accidentally re-purchase and get double-charged.
  // Logged-out users and free users both see pricing as normal.
  const user = await currentUser();

  let userContext: UserContext | null = null;

  if (user) {
    const profile = await getOrLinkProfile(user);
    if (profile?.subscription_status === "pro") {
      redirect("/dashboard");
    }
    if (profile && profile.level && profile.goal && profile.created_at) {
      const createdAtMs = new Date(profile.created_at).getTime();
      const daysSinceSignup = Math.max(
        0,
        Math.floor((Date.now() - createdAtMs) / (24 * 60 * 60 * 1000)),
      );
      userContext = {
        firstName: user.firstName ?? null,
        level: profile.level as Level,
        goal: profile.goal as Goal,
        daysSinceSignup,
      };
    }
  }

  // Fallback: logged-out users arriving from the `/start` result view carry
  // their level + goal in the query string. Personalise the hero based on
  // that even though we don't have a session. The values are non-sensitive
  // and only affect cosmetic copy, so trusting the query string is fine.
  if (!userContext) {
    const params = await searchParams;
    const level = params.level && (VALID_LEVELS as string[]).includes(params.level) ? (params.level as Level) : null;
    const goal  = params.goal  && (VALID_GOALS  as string[]).includes(params.goal)  ? (params.goal  as Goal)  : null;
    if (level && goal) {
      userContext = {
        firstName: null,
        level,
        goal,
        daysSinceSignup: 0,
      };
    }
  }

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY!;
  const yearlyPriceId  = process.env.STRIPE_PRICE_ID_YEARLY!;

  return (
    <PricingCards
      monthlyPriceId={monthlyPriceId}
      yearlyPriceId={yearlyPriceId}
      userContext={userContext}
    />
  );
}
