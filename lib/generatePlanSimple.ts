// lib/generatePlanSimple.ts
// FREE-TIER plan generation — used exclusively by /start onboarding.
//
// Design principles:
//   - Inputs: pull-up / push-up / dip counts, goal, days/week, equipment
//   - No skill tree, no workout history, no progression tracking
//   - Gemini gets the exercise library from exerciseData.ts and picks
//     appropriate exercises based on the user's rep counts
//   - Fast, low-friction, no auth required
//
// Exercise data comes from lib/exerciseData.ts (shared with pro tier).
// Logic here is intentionally simple and separate from pro planning.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { generatePlan } from "./plan";
import { WORKOUT_CHAINS, SCHEDULES, filterByEquipment } from "./exerciseData";
import type { EquipmentTag } from "./skillTree";
import type { Goal, WeeklyPlan, TrainingDay, Exercise } from "@/types";

// ─── Equipment helpers ────────────────────────────────────────────────────────

const FORM_TO_TAG: Record<string, EquipmentTag> = {
  "Pull-up bar":              "bar",
  "Parallel bars / dip bars": "bars",
  "Rings":                    "rings",
  "Parallettes":              "parallettes",
  "Resistance bands":         "bands",
  "Nordic curl anchor":       "anchor",
  "Weights (belt or vest)":   "weights",
  "Vertical pole":            "pole",
};

function buildEquipSet(equipment: string[]): Set<EquipmentTag> {
  const s = new Set<EquipmentTag>();
  for (const item of equipment) {
    const tag = FORM_TO_TAG[item];
    if (tag) s.add(tag);
  }
  return s;
}

// ─── Exercise library string for the prompt ───────────────────────────────────

function buildExerciseLibrary(eq: Set<EquipmentTag>): string {
  const chains = filterByEquipment(WORKOUT_CHAINS, eq);
  return chains
    .map(chain => {
      const exercises = chain.exercises
        .map(ex => {
          const eqNote = ex.equipment.length > 0 ? ` [${ex.equipment.join(", ")}]` : "";
          return `${ex.name}${eqNote}`;
        })
        .join(" → ");
      return `${chain.label} (easiest → hardest):\n  ${exercises}`;
    })
    .join("\n\n");
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSimplePrompt(
  pullUps:     number,
  pushUps:     number,
  dips:        number,
  goal:        Goal,
  daysPerWeek: number,
  equipment:   string[],
): string {
  const eq      = buildEquipSet(equipment);
  const clamped = Math.min(6, Math.max(1, daysPerWeek));

  const goalLabel = goal === "build-strength" ? "Build Strength"
    : goal === "build-muscle" ? "Build Muscle"
    : "Build Strength & Muscle";

  const repScheme = goal === "build-muscle"
    ? "hypertrophy: 3–4 sets × 8–15 reps"
    : goal === "build-strength"
    ? "strength: 3–5 sets × 3–8 reps"
    : "strength-muscle: 3–5 sets × 5–10 reps";

  const pullCtx = pullUps === 0
    ? "cannot do pull-ups — use dead hang or negatives only"
    : pullUps <= 3  ? "1–3 pull-ups — negatives and banded pull-ups"
    : pullUps <= 8  ? "4–8 pull-ups — pull-up is main exercise"
    : pullUps <= 14 ? "9–14 pull-ups — pull-up or explosive pull-up"
    : "15+ pull-ups — weighted or archer pull-up";

  const pushCtx = pushUps <= 5
    ? "very weak — incline or knee push-ups only"
    : pushUps <= 15 ? "beginner — standard push-ups, begin pike push-ups"
    : pushUps <= 29 ? "intermediate — standard push-ups + pike push-ups"
    : "strong — pike/decline push-ups, start wall-assisted HSPU";

  const dipCtx = dips === 0
    ? "cannot do dips — bench dips only"
    : dips <= 3  ? "1–3 dips — bench dips or dip negatives"
    : dips <= 8  ? "4–8 dips — regular dips"
    : "9+ dips — regular or weighted dips";

  const library = buildExerciseLibrary(eq);
  const eqList  = equipment.length > 0 ? equipment.join(", ") : "bodyweight only";

  return `You are an expert calisthenics coach. Design a personalised 7-day starter program.

USER STATS:
- Pull-ups max: ${pullUps} → ${pullCtx}
- Push-ups max: ${pushUps} → ${pushCtx}
- Dips max: ${dips} → ${dipCtx}
- Goal: ${goalLabel} — ${repScheme}
- Training days/week: ${daysPerWeek}
- Equipment: ${eqList}

EXERCISE LIBRARY — use ONLY exercises from this list (easiest → hardest within each pattern):
${library}

SCHEDULE: ${SCHEDULES[clamped]}
Focus labels: Pull → "Pull — Back & Core" | Push → "Push — Chest & Shoulders" | Legs → "Legs & Core" | Full Body → "Full Body"

RULES:
1. Pick exercises appropriate for the user's level using the stat context above.
2. Only assign exercises the user has equipment for — the library is already filtered.
3. You may add 1 "hard set" (isHardSet: true, 2 sets, lower reps) of the next exercise in a chain to expose the user to the next level.
4. Session structure:
   - Pull: 1–2 vertical pull + 1 horizontal pull + 1–2 core (4–5 exercises)
   - Push: 1 vertical push + 1 horizontal push + 1 dip variation + 1 core (4–5 exercises)
   - Legs: 2–3 leg exercises + 1–2 core (3–5 exercises)
   - Full Body: 1 pull + 1 push + 1 legs + 1 core (4–5 exercises)
5. Keep skillWork as an empty array [] — this is a starter plan with no skill goals.
6. Keep volume beginner-appropriate: 3–4 exercises per session minimum, 6 maximum.

Return ONLY valid JSON, no markdown:
{
  "days": [
    {
      "day": "Monday",
      "type": "training",
      "focus": "Full Body",
      "skillWork": [],
      "exercises": [
        { "name": "Pull-up", "sets": 3, "reps": "5–7", "isHardSet": false, "isSkillWork": false }
      ]
    },
    { "day": "Tuesday", "type": "rest" }
  ],
  "note": "2-sentence motivating coaching note for this user's level and goal."
}

Return exactly 7 days (Monday–Sunday). Rest days: only "day" and "type".`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function parseExercise(raw: unknown): Exercise {
  if (typeof raw !== "object" || raw === null) throw new Error("exercise not object");
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== "string" || !e.name) throw new Error("exercise missing name");
  if (typeof e.sets !== "number") throw new Error(`"${e.name}" sets not number`);
  if (typeof e.reps !== "string" || !e.reps) throw new Error(`"${e.name}" reps not string`);
  return {
    name:        e.name,
    sets:        e.sets,
    reps:        e.reps,
    isHardSet:   Boolean(e.isHardSet),
    isSkillWork: false,
  };
}

function validatePlan(data: unknown): WeeklyPlan {
  if (typeof data !== "object" || data === null) throw new Error("response not object");
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.days) || d.days.length !== 7)
    throw new Error(`expected 7 days, got ${Array.isArray(d.days) ? d.days.length : "non-array"}`);
  if (typeof d.note !== "string") throw new Error("note must be string");

  const days: TrainingDay[] = d.days.map((day: unknown, i: number) => {
    if (typeof day !== "object" || day === null) throw new Error(`day ${i} not object`);
    const dd = day as Record<string, unknown>;
    if (typeof dd.day !== "string") throw new Error(`day ${i} missing name`);
    if (dd.type !== "training" && dd.type !== "rest") throw new Error(`day ${i} invalid type`);
    if (dd.type === "rest") return { day: dd.day, type: "rest" as const };
    if (!Array.isArray(dd.exercises) || dd.exercises.length === 0)
      throw new Error(`day ${i} (${dd.day}) missing exercises`);
    return {
      day:       dd.day,
      type:      "training" as const,
      focus:     typeof dd.focus === "string" ? dd.focus : undefined,
      exercises: (dd.exercises as unknown[]).map(ex => parseExercise(ex)),
      skillWork: [],
    };
  });

  return { days, note: d.note };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function generatePlanSimple(
  pullUps:     number,
  pushUps:     number,
  dips:        number,
  goal:        Goal,
  daysPerWeek: number,
  equipment:   string[],
): Promise<WeeklyPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[generatePlanSimple] No GEMINI_API_KEY — using TypeScript fallback");
    return generatePlan(pullUps, pushUps, dips, goal, daysPerWeek, equipment, 1, []);
  }

  const prompt = buildSimplePrompt(pullUps, pushUps, dips, goal, daysPerWeek, equipment);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens:  4096,
        temperature:      1.0,
      },
    });

    const result  = await model.generateContent(prompt);
    const text    = result.response.text();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return validatePlan(JSON.parse(cleaned));
  } catch (err) {
    console.error("[generatePlanSimple] Gemini failed — TypeScript fallback:", err);
    return generatePlan(pullUps, pushUps, dips, goal, daysPerWeek, equipment, 1, []);
  }
}
