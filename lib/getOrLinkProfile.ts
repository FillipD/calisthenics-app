import type { User } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Fetch a user's profile row, linking an unlinked profile (created via /start
 * before sign-up) to the current Clerk user on first authenticated visit.
 *
 * Lookup order:
 *   1. profiles.clerk_id === user.id
 *   2. profiles.email === user's primary email → link it by writing clerk_id
 *
 * Returns the profile row, or null if no matching profile exists.
 */
export async function getOrLinkProfile(user: User) {
  // 1. Try clerk_id match (the normal case)
  const { data: byClerkId } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", user.id)
    .single();

  if (byClerkId) return byClerkId;

  // 2. Fall back to email match (user came through /start before signing up)
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const { data: byEmail } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("email", email)
    .single();

  if (!byEmail) return null;

  // Link the two: write clerk_id onto the existing row so subsequent lookups hit branch 1
  await supabaseAdmin
    .from("profiles")
    .update({ clerk_id: user.id })
    .eq("email", email);

  return { ...byEmail, clerk_id: user.id };
}
