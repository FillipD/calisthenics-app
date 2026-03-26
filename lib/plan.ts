// lib/plan.ts
// Generates a full 7-day plan (4 training days + 3 rest days)
// Structure: Mon Pull | Tue Push | Wed Legs | Thu Rest | Fri Pull | Sat Push | Sun Legs

import { Level, Goal, WeeklyPlan, TrainingDay, Exercise } from "@/types";

export function generatePlan(level: Level, goal: Goal): WeeklyPlan {
  const days: TrainingDay[] = [
    buildPullDay(level, "Monday"),
    buildPushDay(level, "Tuesday"),
    buildLegDay(level, "Wednesday"),
    restDay("Thursday"),
    buildPullDay(level, "Friday"),
    buildPushDay(level, "Saturday"),
    buildLegDay(level, "Sunday"),
  ];

  let note = "";
  if (goal === "lose-weight") {
    note =
      "Max -2 means stop 1–2 reps before failure — you should feel like you could squeeze out one more. This keeps quality high across all sets. Rest 45–60 seconds between sets to keep your heart rate elevated. Push the cardio on leg days. Light walking on rest days is encouraged.";
  } else if (goal === "build-muscle") {
    note =
      "Max -2 means stop 1–2 reps before failure — this keeps quality high across all sets. Rest 90–120 seconds between sets so you can push hard every set. Aim for 1.6–2g of protein per kg of bodyweight. Rest days are when you grow — prioritise sleep.";
  } else {
    note =
      "Max -2 means stop 1–2 reps before failure. Rest 60–90 seconds between sets. Log your rep counts each session and aim to beat them over time — that's how you know you're progressing.";
  }

  return { days, note };
}

function restDay(day: string): TrainingDay {
  return { day, type: "rest" };
}

// ─── Pull Day ────────────────────────────────────────────────────────────────

function buildPullDay(level: Level, day: string): TrainingDay {
  let exercises: Exercise[];

  if (level === "Beginner") {
    exercises = [
      { name: "Dead Hang",              sets: 3, reps: "20–30 sec" },
      { name: "Scapular Pulls",         sets: 3, reps: "Max -2" },
      { name: "Inverted Row (high bar)", sets: 3, reps: "Max -2" },
      { name: "Negative Pull-ups",      sets: 3, reps: "3–5" },
    ];
  } else if (level === "Beginner+") {
    exercises = [
      { name: "Band-Assisted Pull-ups", sets: 3, reps: "Max -2" },
      { name: "Australian Rows",        sets: 3, reps: "Max -2" },
      { name: "Inverted Row (low bar)", sets: 3, reps: "Max -2" },
      { name: "Dead Hang",              sets: 3, reps: "30–45 sec" },
    ];
  } else if (level === "Intermediate") {
    exercises = [
      { name: "Pull-ups",              sets: 3, reps: "Max -2" },
      { name: "Chin-ups",              sets: 3, reps: "Max -2" },
      { name: "Inverted Rows",         sets: 3, reps: "Max -2" },
      { name: "Hanging Knee Raises",   sets: 3, reps: "Max -2" },
    ];
  } else {
    exercises = [
      { name: "Weighted Pull-ups",     sets: 3, reps: "Max -2" },
      { name: "Archer Pull-ups",       sets: 3, reps: "Max -2 each side" },
      { name: "L-sit Pull-ups",        sets: 3, reps: "Max -2" },
      { name: "Muscle-up Negatives",   sets: 3, reps: "3–5" },
    ];
  }

  return { day, type: "training", focus: "Pull — Back & Biceps", exercises };
}

// ─── Push Day ────────────────────────────────────────────────────────────────

function buildPushDay(level: Level, day: string): TrainingDay {
  let exercises: Exercise[];

  if (level === "Beginner") {
    exercises = [
      { name: "Incline Push-ups",     sets: 3, reps: "Max -2" },
      { name: "Knee Push-ups",        sets: 3, reps: "Max -2" },
      { name: "Bench Dips",           sets: 3, reps: "Max -2" },
      { name: "Wall Pike Push-ups",   sets: 3, reps: "Max -2" },
    ];
  } else if (level === "Beginner+") {
    exercises = [
      { name: "Push-ups",             sets: 3, reps: "Max -2" },
      { name: "Bench Dips",           sets: 3, reps: "Max -2" },
      { name: "Pike Push-ups",        sets: 3, reps: "Max -2" },
      { name: "Diamond Push-ups",     sets: 3, reps: "Max -2" },
    ];
  } else if (level === "Intermediate") {
    exercises = [
      { name: "Diamond Push-ups",         sets: 3, reps: "Max -2" },
      { name: "Parallel Bar Dips",        sets: 3, reps: "Max -2" },
      { name: "Decline Push-ups",         sets: 3, reps: "Max -2" },
      { name: "Pike Push-ups",            sets: 3, reps: "Max -2" },
    ];
  } else {
    exercises = [
      { name: "Weighted Dips",            sets: 3, reps: "Max -2" },
      { name: "Archer Push-ups",          sets: 3, reps: "Max -2 each side" },
      { name: "Ring Dips",                sets: 3, reps: "Max -2" },
      { name: "Pseudo Planche Push-ups",  sets: 3, reps: "Max -2" },
    ];
  }

  return { day, type: "training", focus: "Push — Chest, Shoulders & Triceps", exercises };
}

// ─── Leg Day ─────────────────────────────────────────────────────────────────

function buildLegDay(level: Level, day: string): TrainingDay {
  let exercises: Exercise[];

  if (level === "Beginner") {
    exercises = [
      { name: "Bodyweight Squats",    sets: 3, reps: "15–20" },
      { name: "Lunges",               sets: 3, reps: "10 each leg" },
      { name: "Glute Bridges",        sets: 3, reps: "15–20" },
      { name: "Calf Raises",          sets: 3, reps: "20" },
      { name: "Walk",                 sets: 1, reps: "15 min" },
    ];
  } else if (level === "Beginner+") {
    exercises = [
      { name: "Jump Squats",              sets: 3, reps: "10–12" },
      { name: "Reverse Lunges",           sets: 3, reps: "10 each leg" },
      { name: "Single-Leg Glute Bridge",  sets: 3, reps: "10–12 each" },
      { name: "Calf Raises",              sets: 3, reps: "20" },
      { name: "Easy Run",                 sets: 1, reps: "20 min" },
    ];
  } else if (level === "Intermediate") {
    exercises = [
      { name: "Bulgarian Split Squats",   sets: 3, reps: "Max -2 each" },
      { name: "Pistol Squat Progression", sets: 3, reps: "Max -2 each" },
      { name: "Box Jumps",                sets: 3, reps: "8–10" },
      { name: "Run",                      sets: 1, reps: "30 min" },
    ];
  } else {
    exercises = [
      { name: "Pistol Squats",   sets: 3, reps: "Max -2 each" },
      { name: "Jump Lunges",     sets: 3, reps: "10 each" },
      { name: "Shrimp Squats",   sets: 3, reps: "Max -2 each" },
      { name: "Run / Sprints",   sets: 1, reps: "40 min or 8×100m sprints" },
    ];
  }

  return { day, type: "training", focus: "Legs & Cardio", exercises };
}
