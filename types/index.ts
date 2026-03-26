// types/index.ts
// Shared TypeScript types used across the app

export type Goal =
  | "lose-weight"
  | "build-muscle"
  | "build-muscle-lose-weight";

export type Level = "Beginner" | "Beginner+" | "Intermediate" | "Advanced";

// What the user submits in the form
export interface FormData {
  pullUps: number;
  pushUps: number;
  dips: number;
  goal: Goal;
  email: string;
}

// What the server returns after processing
export interface AssessmentResult {
  level: Level;
  summary: string;
  plan: WeeklyPlan;
}

// One exercise in a session
export interface Exercise {
  name: string;
  sets: number;
  reps: string; // e.g. "8-10" or "30 sec"
}

// One day in the week (training or rest)
export interface TrainingDay {
  day: string;        // e.g. "Monday"
  type: "training" | "rest";
  focus?: string;     // only for training days
  exercises?: Exercise[]; // only for training days
}

// The full 1-week plan
export interface WeeklyPlan {
  days: TrainingDay[];
  note: string;
}
