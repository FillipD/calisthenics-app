// app/api/subscribe/route.ts
// Server-side only — beehiiv API key stays here, never sent to the browser

import { NextRequest, NextResponse } from "next/server";
import { assessUser } from "@/lib/assess";
import { sendPlanEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase";
import { FormData } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: FormData = await req.json();
    const { email } = body;

    // Basic server-side validation
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const result = assessUser(body, []);

    // Subscribe to beehiiv (non-blocking: we still return the plan if it fails)
    const beehiivResult = await subscribeToBeehiiv({
      email,
      goal: body.goal,
      level: result.level,
    });

    if (!beehiivResult.success) {
      console.error("beehiiv subscription error:", beehiivResult.error);
    }

    // Send training plan email via Resend (non-blocking)
    const emailResult = await sendPlanEmail(email, result);
    if (!emailResult.success) {
      console.error("Resend email error:", emailResult.error);
    }

    // Upsert profile in Supabase — saves email, goal, level, training preferences
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        email,
        goal: body.goal,
        level: result.level,
        days_per_week: body.daysPerWeek,
        equipment: body.equipment,
      }, { onConflict: "email" });
    if (dbError) {
      console.error("Supabase profile upsert error:", dbError.message);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

async function subscribeToBeehiiv({
  email,
  goal,
  level,
}: {
  email: string;
  goal: string;
  level: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !publicationId) {
    console.warn("beehiiv env vars missing — skipping subscription.");
    return { success: false, error: "Missing env vars" };
  }

  try {
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: "landing-page",
          utm_medium: "organic",
          custom_fields: [
            { name: "goal", value: goal },
            { name: "level", value: level },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
