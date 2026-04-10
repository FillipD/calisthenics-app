// lib/workoutEval.ts
// Deterministic post-workout evaluation.
// Classifies each exercise into a simple outcome based on:
//   - the prescribed reps/hold range
//   - the user's per-set logged values
//   - whether they swapped to an easier or harder variation
//
// Does NOT write to the database. The per-set data is already persisted in
// weekly_logs.sets_data and can be re-evaluated server-side for future
// progression-aware plan generation.

export type ExerciseOutcome =
  | "ready_to_progress"   // consistently hit the top of the prescribed range
  | "stay_here"           // within range, or mixed but mostly solid
  | "consider_easier"     // consistently below range
  | "insufficient_data";  // too few sets logged to judge

export interface ExerciseEval {
  name:        string;
  outcome:     ExerciseOutcome;
  isSkillWork: boolean;
}

export interface WorkoutEval {
  exercises: ExerciseEval[];
  takeaway:  string;
}

export interface EvalInput {
  name:           string;
  prescribedSets: number;
  prescribedReps: string;          // original prescription string, e.g. "8–12", "5–10s", "Max"
  loggedSets:     (number | "")[]; // per-set values from the input fields
  swapDirection:  "easier" | "harder" | "alternative" | null;
  isSkillWork:    boolean;
}

// Parses "6–8", "6-8", "5–10s", "5-10 sec", etc. into { lo, hi }.
// Returns null for "Max", single numbers, or anything unrecognised.
function parseRepRange(reps: string): { lo: number; hi: number } | null {
  const m = reps.match(/^(\d+)[–\-](\d+)/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo >= hi) return null; // degenerate range — treat as unparseable
  return { lo, hi };
}

function classifyExercise(input: EvalInput): ExerciseOutcome {
  const { prescribedSets, prescribedReps, loggedSets, swapDirection } = input;

  const completedNums = loggedSets
    .filter(v => v !== "" && Number(v) > 0)
    .map(Number);

  // Not enough logged sets to make a judgement
  if (completedNums.length === 0) return "insufficient_data";
  if (completedNums.length < prescribedSets * 0.5) return "insufficient_data";

  const range = parseRepRange(prescribedReps);

  // "Max" reps or unrecognised format — can only confirm they trained
  if (!range) {
    if (swapDirection === "easier") return "consider_easier";
    return "stay_here";
  }

  const { lo, hi } = range;
  const total   = completedNums.length;
  const atTop   = completedNums.filter(n => n >= hi).length;
  const inRange = completedNums.filter(n => n >= lo && n < hi).length;
  const below   = completedNums.filter(n => n < lo).length;

  // Lower the ready_to_progress bar slightly when they pushed up to a harder variation
  const progressThreshold = swapDirection === "harder" ? 0.5 : 2 / 3;

  if (atTop / prescribedSets >= progressThreshold) return "ready_to_progress";

  if (below / total >= 2 / 3) {
    // Swapped to harder and fell short is expected — don't penalise as consider_easier
    return swapDirection === "harder" ? "stay_here" : "consider_easier";
  }

  if ((atTop + inRange) / total >= 0.5) return "stay_here";

  // Default: conservative — stay the course unless clearly ready or struggling
  return "stay_here";
}

export function evaluateWorkout(inputs: EvalInput[]): WorkoutEval {
  const exercises: ExerciseEval[] = inputs.map(input => ({
    name:        input.name,
    outcome:     classifyExercise(input),
    isSkillWork: input.isSkillWork,
  }));

  const sufficient      = exercises.filter(e => e.outcome !== "insufficient_data");
  const progressCount   = exercises.filter(e => e.outcome === "ready_to_progress").length;
  const easierCount     = exercises.filter(e => e.outcome === "consider_easier").length;
  const sufficientCount = sufficient.length;

  let takeaway: string;

  if (sufficientCount === 0) {
    takeaway = "Log your reps next time to get detailed progression feedback.";
  } else if (progressCount >= Math.ceil(sufficientCount * 0.5)) {
    takeaway =
      progressCount === 1
        ? "Strong session — 1 exercise is ready to progress next week."
        : `Strong session — ${progressCount} exercises are ready to progress next week.`;
  } else if (easierCount >= Math.ceil(sufficientCount * 0.5)) {
    takeaway = "Consider scaling back on a few exercises. Quality reps matter more than hitting the numbers.";
  } else {
    takeaway = "Solid session. Stay the course — consistency is how progress compounds.";
  }

  return { exercises, takeaway };
}
