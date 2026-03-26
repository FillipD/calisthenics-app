// lib/email.ts
// Builds and sends the training plan email via Resend

import { Resend } from "resend";
import { AssessmentResult, TrainingDay } from "@/types";

const resend = new Resend(process.env.RESEND_API_KEY);

const COLORS = {
  bg: "#1a1a18",
  card: "#242422",
  border: "#2e2e2c",
  chalk: "#f5f0e8",
  muted: "#6b6b60",
  muscle: "#c8f04a",
  rust: "#e05a2b",
};

export async function sendPlanEmail(
  email: string,
  result: AssessmentResult
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn("Resend env vars missing — skipping email.");
    return { success: false, error: "Missing env vars" };
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Your ${result.level} calisthenics plan`,
      html: buildEmailHtml(result),
    });

    if (error) {
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function buildEmailHtml(result: AssessmentResult): string {
  const { level, summary, plan } = result;

  const dayRows = plan.days.map(buildDayBlock).join("");

  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your training plan</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:'DM Sans',Arial,sans-serif;color:${COLORS.chalk};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;">

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.chalk};">Hey, it's Fillip from Caliplan. Here's your personalised training plan — built for where you actually are right now. Let's get to work.</p>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};">Your plan</p>
              <h1 style="margin:0;font-size:32px;font-weight:700;color:${COLORS.chalk};">${level}</h1>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:${COLORS.chalk};">${summary}</p>
            </td>
          </tr>

          <tr><td style="height:24px;"></td></tr>

          <!-- Days -->
          ${dayRows}

          <!-- Coaching note -->
          <tr>
            <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-left:3px solid ${COLORS.muscle};border-radius:8px;padding:20px;margin-top:8px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muscle};">Coaching note</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.chalk};">${plan.note}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${COLORS.muted};">You're receiving this because you signed up for a calisthenics plan.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildDayBlock(day: TrainingDay): string {
  if (day.type === "rest") {
    return /* html */ `
    <tr>
      <td style="padding-bottom:12px;">
        <table width="100%" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:16px 20px;">
          <tr>
            <td>
              <span style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">${day.day}</span>
              <span style="margin-left:12px;font-size:13px;color:${COLORS.muted};">Rest day</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }

  const exerciseRows = (day.exercises ?? [])
    .map(
      (ex) => /* html */ `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.chalk};">${ex.name}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.muted};text-align:center;">${ex.sets}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.muted};text-align:right;">${ex.reps}</td>
      </tr>`
    )
    .join("");

  return /* html */ `
  <tr>
    <td style="padding-bottom:12px;">
      <table width="100%" style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:16px 20px;">
        <tr>
          <td style="padding-bottom:12px;">
            <p style="margin:0 0 2px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.rust};">${day.day}</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:${COLORS.chalk};">${day.focus}</p>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <th style="padding-bottom:8px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};text-align:left;font-weight:400;">Exercise</th>
                <th style="padding-bottom:8px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};text-align:center;font-weight:400;">Sets</th>
                <th style="padding-bottom:8px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.muted};text-align:right;font-weight:400;">Reps</th>
              </tr>
              ${exerciseRows}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}
