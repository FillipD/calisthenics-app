import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";
import PricingCards from "./PricingCards";

export default async function PricingPage() {
  // Pro users should never see this page — bounce them to the dashboard so
  // they can't accidentally re-purchase and get double-charged.
  // Logged-out users and free users both see pricing as normal.
  const user = await currentUser();
  if (user) {
    const profile = await getOrLinkProfile(user);
    if (profile?.subscription_status === "pro") {
      redirect("/dashboard");
    }
  }

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY!;
  const yearlyPriceId  = process.env.STRIPE_PRICE_ID_YEARLY!;

  return <PricingCards monthlyPriceId={monthlyPriceId} yearlyPriceId={yearlyPriceId} />;
}
