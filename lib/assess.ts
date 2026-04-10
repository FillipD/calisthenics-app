// lib/assess.ts
// Determines fitness level from rep counts and generates a plan.
// /start (free tier) uses the deterministic TypeScript generator — no AI required.

import { FormData, Level, AssessmentResult, SkillGoal } from "@/types";
import { generatePlan } from "./plan";

export function assessUser(
  data: FormData,
  skillGoals: SkillGoal[] = [],
): AssessmentResult {
  const { pullUps, pushUps, dips, goal, daysPerWeek, equipment } = data;

  type Strength = "weak" | "moderate" | "decent" | "strong";

  // ── Pulling strength ──────────────────────────────────────────────────────
  const pullStrength: Strength =
    pullUps === 0 ? "weak"
    : pullUps <= 3 ? "moderate"
    : pullUps <= 14 ? "decent"
    : "strong";

  // ── Pushing strength ──────────────────────────────────────────────────────
  const pushStrength: Strength =
    pushUps <= 5 ? "weak"
    : pushUps <= 15 ? "moderate"
    : pushUps <= 29 ? "decent"
    : "strong";

  // ── Dip ability ───────────────────────────────────────────────────────────
  const dipStrength: Strength =
    dips === 0 ? "weak"
    : dips <= 3 ? "moderate"
    : dips <= 14 ? "decent"
    : "strong";

  const scores      = [pullStrength, pushStrength, dipStrength];
  const weakAreas   = scores.filter(s => s === "weak").length;
  const strongAreas = scores.filter(s => s === "strong").length;

  // ── Assign level ──────────────────────────────────────────────────────────
  let level: Level;
  let summary: string;

  if (strongAreas === 3) {
    level   = "Advanced";
    summary = "You're operating at a high level. This plan is built to push your limits — heavier progressions, more volume, and movements that demand real strength and control. Stay sharp.";
  } else if (weakAreas === 0) {
    level   = "Intermediate";
    summary = "You have a solid base across the board. This plan targets the next step — building volume, refining technique, and closing the gap to advanced movements. Progress compounds here.";
  } else if (weakAreas === 1) {
    level   = "Beginner+";
    summary = "You have some base fitness but clear gaps to fill. This plan targets your weaker areas while reinforcing what you already have. You'll progress quickly with focused training.";
  } else {
    level   = "Beginner";
    summary = "You're just getting started — that's perfect. This plan builds the foundations you need: grip strength, pushing power, and body control. Consistency beats intensity at this stage.";
  }

  const plan = generatePlan(pullUps, pushUps, dips, goal, daysPerWeek, equipment, 1, skillGoals);

  return { level, summary, plan };
}
