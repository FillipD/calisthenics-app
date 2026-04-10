// lib/generatePlanAI.ts
// Pro-tier plan generation for the dashboard.
// Gemini receives a structured PlannerInput — explicit exercise pools per
// movement pattern and skill step prescriptions — rather than annotated chain
// text. This prevents exercise hallucination and keeps prompt size proportional
// to the user's active goals.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { LEVEL_REPS, generatePlan } from "./plan";
import { buildPlannerInput, resolveSwapOptions } from "./plannerInput";
import type { PlannerInput } from "./plannerInput";
import type { Goal, WeeklyPlan, TrainingDay, Exercise, SkillGoal, UserProgress } from "@/types";
import type { EquipmentTag } from "./skillTree";
import { evaluateWorkout, type EvalInput, type ExerciseOutcome } from "./workoutEval";

// ─── Recent log type ──────────────────────────────────────────────────────────

export interface RecentWorkoutLog {
  week_number:    number;
  day_label:      string;
  exercise_name:  string;
  sets_completed: number;
  reps_completed: number;
  /** Per-set rep data saved at log time. Present when the workout was completed via the app. */
  sets_data?:     Array<{ set: number; reps: number }> | null;
}

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

// ─── Rep-count → chain-index helpers (used by repsFromProgress only) ─────────
// These drive the TypeScript fallback path in generatePlanFromProfile for users
// with no saved tree state. Not used for Gemini prompt building.

const CHAIN_VERT_PULL  = ["pullup-negative", "banded-pullup", "pullup", "explosive-pullup", "weighted-pullup", "archer-pullup"];
const CHAIN_HORIZ_PUSH = ["incline-knee-pu", "knee-pu", "incline-pu", "standard-pu", "explosive-pu", "archer-pu"];
const CHAIN_DIPS       = ["bench-dip", "dip-negative", "banded-dip", "dip", "weighted-dip"];

function chainIdxFromProgress(chain: string[], progressMap: Record<string, string>): number {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (progressMap[chain[i]] === "current" || progressMap[chain[i]] === "completed") return i;
  }
  return -1;
}

// ─── Progress-derived rep estimates ──────────────────────────────────────────
// Maps a user's saved chain position to approximate rep counts for the TS
// fallback plan. Not used in the Gemini path.

const VERT_PULL_IDX_REPS  = [0,  1,  5,  8, 12, 15] as const;
const HORIZ_PUSH_IDX_REPS = [5, 10, 15, 20, 30, 40] as const;
const DIPS_IDX_REPS       = [0,  1,  3,  8, 12]     as const;

function repsFromProgress(
  progressMap: Record<string, string>,
): { pullUps: number; pushUps: number; dips: number } {
  const pullIdx  = chainIdxFromProgress(CHAIN_VERT_PULL,  progressMap);
  const hpushIdx = chainIdxFromProgress(CHAIN_HORIZ_PUSH, progressMap);
  const dipIdx   = chainIdxFromProgress(CHAIN_DIPS,       progressMap);
  return {
    pullUps: pullIdx  >= 0 ? (VERT_PULL_IDX_REPS [pullIdx]  ?? 15) : 0,
    pushUps: hpushIdx >= 0 ? (HORIZ_PUSH_IDX_REPS[hpushIdx] ?? 40) : 5,
    dips:    dipIdx   >= 0 ? (DIPS_IDX_REPS      [dipIdx]   ?? 12) : 0,
  };
}

// ─── Recent logs context ──────────────────────────────────────────────────────

function buildLogsContext(logs: RecentWorkoutLog[]): string {
  if (logs.length === 0) return "No workout history yet — this is their first generated plan.";

  const byWeek = new Map<number, Map<string, RecentWorkoutLog[]>>();
  for (const log of logs) {
    if (!byWeek.has(log.week_number)) byWeek.set(log.week_number, new Map());
    const wMap = byWeek.get(log.week_number)!;
    if (!wMap.has(log.day_label)) wMap.set(log.day_label, []);
    wMap.get(log.day_label)!.push(log);
  }

  const lines: string[] = [];
  for (const [week, days] of Array.from(byWeek.entries()).sort(([a], [b]) => b - a)) {
    lines.push(`Week ${week}:`);
    for (const [day, exercises] of days) {
      const exStr = exercises
        .map(e => `${e.exercise_name} ${e.sets_completed}×${e.reps_completed}`)
        .join(" | ");
      lines.push(`  ${day}: ${exStr}`);
    }
  }
  return lines.join("\n");
}

// ─── Performance context builder ─────────────────────────────────────────────
// Evaluates recent workout logs against the previous week's prescriptions to
// produce per-exercise signals for the Gemini prompt.
//
// Requires sets_data on each log (saved since post-workout feedback was added).
// Logs without sets_data are skipped; the function returns "" when no data exists.

function buildPerformanceContext(
  logs:         RecentWorkoutLog[],
  previousPlan: WeeklyPlan | null,
): string {
  const logsWithData = logs.filter(l => Array.isArray(l.sets_data) && l.sets_data!.length > 0);
  if (logsWithData.length === 0) return "";

  // Build prescription lookup: canonical name (lowercased) → { sets, reps }
  const prescriptions = new Map<string, { sets: number; reps: string }>();
  if (previousPlan) {
    for (const day of previousPlan.days) {
      if (day.type !== "training") continue;
      for (const ex of [...(day.exercises ?? []), ...(day.skillWork ?? [])]) {
        prescriptions.set(ex.name.toLowerCase(), { sets: ex.sets, reps: ex.reps });
      }
    }
  }

  // Evaluate each log entry against its prescription
  const rawOutcomes: Array<{ name: string; outcome: ExerciseOutcome }> = [];

  for (const log of logsWithData) {
    const presc = prescriptions.get(log.exercise_name.toLowerCase());
    const setsArr = (log.sets_data ?? []).map(s => s.reps);

    // When no prescription exists (e.g. swapped exercise) use fallback values that
    // will likely produce insufficient_data unless completion is very clear.
    const evalInput: EvalInput = {
      name:           log.exercise_name,
      prescribedSets: presc?.sets ?? Math.max(1, log.sets_completed),
      prescribedReps: presc?.reps ?? "Max",
      loggedSets:     setsArr,
      swapDirection:  null,
      isSkillWork:    false,
    };

    const result  = evaluateWorkout([evalInput]);
    const outcome = result.exercises[0]?.outcome ?? "insufficient_data";
    rawOutcomes.push({ name: log.exercise_name, outcome });
  }

  // Aggregate across multiple sessions: majority vote excluding insufficient_data
  const byName = new Map<string, ExerciseOutcome[]>();
  for (const { name, outcome } of rawOutcomes) {
    const arr = byName.get(name) ?? [];
    arr.push(outcome);
    byName.set(name, arr);
  }

  const groups: Record<ExerciseOutcome, string[]> = {
    ready_to_progress: [],
    stay_here:         [],
    consider_easier:   [],
    insufficient_data: [],
  };

  for (const [name, outcomes] of byName) {
    const meaningful = outcomes.filter(o => o !== "insufficient_data");
    if (meaningful.length === 0) {
      groups.insufficient_data.push(name);
      continue;
    }
    const counts = new Map<ExerciseOutcome, number>();
    for (const o of meaningful) counts.set(o, (counts.get(o) ?? 0) + 1);
    let dominant: ExerciseOutcome = "stay_here";
    let best = 0;
    for (const [o, c] of counts) if (c > best) { dominant = o; best = c; }
    groups[dominant].push(name);
  }

  const hasActionable =
    groups.ready_to_progress.length > 0 ||
    groups.stay_here.length > 0 ||
    groups.consider_easier.length > 0;

  if (!hasActionable) return "";

  const lines: string[] = [
    "Based on logged workouts from the last 1–2 weeks. Use these signals to tune prescription and exercise selection."
  ];

  if (groups.ready_to_progress.length > 0) {
    lines.push(
      "\nREADY TO PROGRESS — consistently hitting the top of the prescribed range:",
      `  ${groups.ready_to_progress.join(" | ")}`,
      "  → Promote the Hard set exercise to the new Working set, or shift rep prescription toward the upper end.",
      "    Skill work: if the advance condition is near, brief next-step exposure in skillWork[] is appropriate.",
    );
  }

  if (groups.stay_here.length > 0) {
    lines.push(
      "\nON TRACK — performing within the prescribed range:",
      `  ${groups.stay_here.join(" | ")}`,
      "  → Keep current prescription and working-set selection.",
    );
  }

  if (groups.consider_easier.length > 0) {
    lines.push(
      "\nCONSIDER SCALING BACK — consistently below the prescribed range:",
      `  ${groups.consider_easier.join(" | ")}`,
      "  → Step back to a lower progression, or reduce intensity (fewer sets / lower rep target).",
      "    Do NOT include hard-set exposure for these exercises this week.",
    );
  }

  if (groups.insufficient_data.length > 0) {
    lines.push(
      "\nINSUFFICIENT DATA — not enough logged sets to evaluate:",
      `  ${groups.insufficient_data.join(" | ")}`,
      "  → Stay conservative; maintain current prescription.",
    );
  }

  return lines.join("\n");
}

// ─── Error type ───────────────────────────────────────────────────────────────
// Thrown when Gemini fails validation on both the initial attempt and the retry.
// Propagates to the API route, which returns a 422 so the frontend can surface
// a user-facing message instead of silently replacing with the TS fallback.

export class ProPlanGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProPlanGenerationError";
  }
}

// ─── Per-day volume budget builder ───────────────────────────────────────────
// Produces one line per day showing whether it is a training day (with its hard
// item cap) or a rest day. Parses the schedule string from PlannerInput which
// has the format "Mon=Pull, Tue=Push, Wed=Rest, …".

const DAY_ABBREV_TO_FULL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday",  Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

function buildPerDayBudgets(schedule: string, minItems: number, maxItems: number): string {
  return schedule
    .split(",")
    .map(s => s.trim())
    .map(entry => {
      const eqIdx  = entry.indexOf("=");
      const abbrev = entry.slice(0, eqIdx).trim();
      const type   = entry.slice(eqIdx + 1).trim();
      const day    = DAY_ABBREV_TO_FULL[abbrev] ?? abbrev;
      return type === "Rest"
        ? `  ${day}: rest`
        : `  ${day} (${type}): TARGET ${minItems}–${maxItems} items  (MAX ${maxItems} = hard limit, AIM for ≥${minItems})`;
    })
    .join("\n");
}

// ─── Pro prompt builder ───────────────────────────────────────────────────────
// Renders the structured PlannerInput into a Gemini prompt.
// Exercise names come from allowedPool — Gemini is told to use them verbatim.

function buildProPrompt(input: PlannerInput): string {
  const {
    weekNumber, goalLabel, repScheme, schedule, equipment,
    sessionLength, volumePerSession, skillWorkCapacity, primarySkillWorkOnly,
    workoutSlots, skillGoals, weeklyBalance, recentHistory, performanceSignals,
    sessionEmphasis, sessionNearDuplicateClusters,
  } = input;

  // ── Movement slots ────────────────────────────────────────────────────────
  const slotsText = workoutSlots.map(slot => {
    const isOptional = slot.skipReason !== null;
    const header = isOptional
      ? `${slot.pattern} [${slot.session.toUpperCase()} sessions]  ⚠ OPTIONAL SLOT — skip if session is full`
      : `${slot.pattern} [${slot.session.toUpperCase()} sessions]`;
    const lines = [header];

    if (isOptional) {
      lines.push(`  Skip reason : ${slot.skipReason}`);
    }

    lines.push(`  Working set : ${slot.workingSet}`);

    if (slot.hardSet) {
      lines.push(`  Hard set    : ${slot.hardSet}  ← 2 sets at lower reps for next-level exposure`);
    }
    if (slot.peerAlternatives.length > 0) {
      lines.push(`  Peer alts   : ${slot.peerAlternatives.join(" | ")}  ← same difficulty as working set; use for variety or equipment fit in support work only`);
    }
    if (slot.nearDuplicateGroups.length > 0) {
      const groupList = slot.nearDuplicateGroups
        .map(g => `[${g.join(", ")}]`)
        .join(" | ");
      lines.push(`  Near-dupe clusters: ${groupList}  ← use at most ONE from each cluster per session in the same role`);
    }
    // Show support range only when it's a meaningful subset of the pool
    if (slot.suggestedSupportRange.length > 0 && slot.suggestedSupportRange.length < slot.allowedPool.length) {
      lines.push(`  Support range: ${slot.suggestedSupportRange.join(" | ")}  ← best choices for support/accessory sets`);
    }
    // The allowed pool is already level-filtered (regressed exercises excluded)
    lines.push(`  Allowed pool: ${slot.allowedPool.join(" | ")}  ← pre-filtered for this user's level; do not use exercises outside this list`);
    return lines.join("\n");
  }).join("\n\n");

  // ── Skill goals ───────────────────────────────────────────────────────────
  const skillsText = skillGoals.length === 0
    ? "None — no active skill goals."
    : skillGoals.map(sg => {
        const freqNote = sg.weeklyDedicatedSessions > 0
          ? `${sg.weeklyDedicatedSessions}x dedicated ${sg.session} session${sg.weeklyDedicatedSessions > 1 ? "s" : ""}/week → include skill work in all of them`
          : `0 dedicated ${sg.session} sessions this week (full-body schedule) → skip skill work`;

        const lines = [
          `PRIORITY ${sg.priority} — ${sg.goalLabel} [${sg.session.toUpperCase()} sessions]`,
          `  Current step   : ${sg.currentStepName}`,
          `  Prescription   : ${sg.prescription}`,
          `  Advance when   : ${sg.advanceCondition}`,
          `  Weekly slots   : ${freqNote}`,
        ];

        // ── Support context ──────────────────────────────────────────────────
        // Derived deterministically from the skill tree — guides Gemini on which
        // support work to prioritise and why.
        const { support } = sg;

        if (support.emphasisSlots.length > 0) {
          const slotList = support.emphasisSlots
            .map(s => `${s.pattern} (${s.reason})`)
            .join("\n                 ");
          lines.push(`  Support slots  : ${slotList}`);
        }

        if (support.foundationWork.length > 0) {
          const fwList = support.foundationWork
            .map(fw => `${fw.name} — ${fw.purpose}`)
            .join(" | ");
          lines.push(`  Foundation work: ${fwList}`);
        }

        if (support.missingPrerequisites.length > 0) {
          const prereqList = support.missingPrerequisites
            .map(p => `${p.name} (${p.role})`)
            .join(", ");
          lines.push(`  Prereq gaps    : ${prereqList}`);
        }

        if (support.peerAlternatives.length > 0) {
          const peerList = support.peerAlternatives
            .map(p => `${p.name} (${p.note})`)
            .join(", ");
          lines.push(`  Peer alts      : ${peerList}  ← support work or secondary-goal variety ONLY — never replace the primary skill block`);
        }

        return lines.join("\n");
      }).join("\n\n");

  // ── Weekly balance ────────────────────────────────────────────────────────
  // Deterministic frequency caps, priority ordering, and overlap warnings.
  // Rendered only when skill goals exist.
  let weeklyBalanceText = "";
  if (weeklyBalance.goalFrequencies.length > 0) {
    // Frequency targets
    const freqLines = weeklyBalance.goalFrequencies.map(gf => {
      const tag = gf.priority === 1 ? "PRIMARY — never skip" : `priority ${gf.priority}`;
      const sessStr = gf.recommendedSessions === 0
        ? "skip this week"
        : `${gf.recommendedSessions} ${gf.sessionType} session${gf.recommendedSessions !== 1 ? "s" : ""}`;
      const cap = gf.cappedReason ? `  ← ${gf.cappedReason}` : "";
      return `  ${gf.goalLabel} [${tag}]  →  ${sessStr}${cap}`;
    });

    // Drop-priority per session type
    const priorityLines = Object.entries(weeklyBalance.sessionPriorityMap).map(([sess, ids]) => {
      const labels = ids.map((id, i) => {
        const gf = weeklyBalance.goalFrequencies.find(g => g.goalId === id);
        const name = gf?.goalLabel ?? id;
        return i === 0 ? `${name} [keep]` : `${name} [drop first when tight]`;
      });
      return `  ${sess.toUpperCase()}: ${labels.join(" → ")}`;
    });

    // Overlap warnings
    const overlapLines = weeklyBalance.overlapRisks.map(r => {
      const a = weeklyBalance.goalFrequencies.find(g => g.goalId === r.primaryGoalId)?.goalLabel   ?? r.primaryGoalId;
      const b = weeklyBalance.goalFrequencies.find(g => g.goalId === r.secondaryGoalId)?.goalLabel ?? r.secondaryGoalId;
      return `  ${a} + ${b} [${r.severity}]: ${r.reason}\n  → ${r.guidance}`;
    });

    const parts = [
      "Goal exposures this week (exact targets — do not exceed):",
      freqLines.join("\n"),
      "",
      "Drop-priority when volume is tight:",
      priorityLines.join("\n"),
    ];
    if (overlapLines.length > 0) {
      parts.push("", "Recovery-overlap warnings (must follow):", overlapLines.join("\n\n"));
    }
    weeklyBalanceText = parts.join("\n");
  }

  // ── Session emphasis (per-day, for repeated session types) ──────────────────
  const emphasisEntries = Object.entries(sessionEmphasis);
  const sessionEmphasisText = emphasisEntries.length > 0
    ? emphasisEntries.map(([day, note]) => `  ${day}: ${note}`).join("\n")
    : "";

  // ── Per-day volume budget table ───────────────────────────────────────────
  const perDayBudgetsText = buildPerDayBudgets(schedule, volumePerSession.min, volumePerSession.max);

  // ── Skill work capacity note ──────────────────────────────────────────────
  const skillCapacityNote = primarySkillWorkOnly
    ? `${sessionLength} min session — include primary goal skill work (priority 1) in every relevant session. Secondary goals and hard-set exposure are dropped to stay within ${volumePerSession.min}–${volumePerSession.max} total exercises.`
    : `Include up to ${skillWorkCapacity} skill work block${skillWorkCapacity > 1 ? "s" : ""} per session — priority 1 first, then secondary goals if slots remain.`;

  return `You are an expert calisthenics coach building week ${weekNumber} of a personalised program.

GOAL: ${goalLabel} — ${repScheme}
SCHEDULE: ${schedule}
EQUIPMENT: ${equipment.length > 0 ? equipment.join(", ") : "bodyweight only"}
SESSION LENGTH: ${sessionLength} minutes
Focus labels: Pull → "Pull — Back & Core" | Push → "Push — Chest & Shoulders" | Legs → "Legs & Core" | Full Body → "Full Body"

━━━ MOVEMENT SLOTS ━━━
These are the ONLY exercises you may use for working sets and hard sets.
Use exercise names EXACTLY as written — do not invent names or variations.

${slotsText}

${sessionNearDuplicateClusters.length > 0
  ? `━━━ CROSS-SLOT NEAR-DUPLICATE CLUSTERS ━━━
These exercises appear in different movement pattern slots but are peer alternatives — same mechanical function at the same level.
Use at most ONE from each cluster per session in the same role:
${sessionNearDuplicateClusters.map(c => `  • [${c.join(", ")}]`).join("\n")}

`
  : ""}━━━ SKILL GOALS ━━━
${skillsText}

━━━ WEEKLY BALANCE ━━━
${weeklyBalanceText}
${sessionEmphasisText ? `\n━━━ SESSION EMPHASIS ━━━\nThese days share the same movement families but must differ in emphasis:\n${sessionEmphasisText}\n` : ""}
━━━ RECENT HISTORY ━━━
${recentHistory}
${performanceSignals ? `
━━━ PERFORMANCE SIGNALS ━━━
${performanceSignals}
` : ""}
━━━ SESSION VOLUME BUDGETS ━━━
Each training session has a TARGET RANGE of ${volumePerSession.min}–${volumePerSession.max} items total (skillWork + exercises combined).
HARD MAXIMUM: never exceed ${volumePerSession.max} items on any training day.
SOFT MINIMUM: aim for at least ${volumePerSession.min} items. A session below ${volumePerSession.min} is underfilled — fill it.

${perDayBudgetsText}

OVERFLOW RULE — if a session exceeds the limit, remove items in this order:
  1. Hard sets (isHardSet: true) — drop first
  2. Exercises from ⚠ OPTIONAL SLOTs — drop next
  3. Secondary skill work — drop last before required items
  NEVER drop: primary skill work or the main working set for each required pattern.

UNDERFILL RULE — if dropping an optional slot or near-duplicate leaves a session below ${volumePerSession.min} items:
  Do NOT leave the session short. Replace the dropped item with a different valid exercise:
  • First choice: a support or accessory movement from the same session-type Allowed pool
  • Second choice: a core exercise from any pool that matches the day
  • Prefer exercises from the Support range (listed per slot) — these are the right level
  • Do NOT re-add the dropped item or its near-duplicate
  • Do NOT invent exercises outside the Allowed pool
  A well-chosen replacement at the right level is always better than an underfilled session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COACHING INSTRUCTIONS

PRIORITY ORDER — apply this when the volume budget is tight:
  1 [NEVER DROP]   Primary goal skill work — include in every dedicated session for that session type
  2 [NEVER DROP]   Primary goal support exercises — the key movement patterns for that session type
  3 [REQUIRED]     Minimum category coverage — at least 1 representative exercise per session type
  4 [DROP FIRST when tight]  Secondary goal skill work — omit at ${sessionLength <= "45" ? "30–45" : "short"} min; include at 60+ min
  5 [DROP FIRST]   Hard-set exposure and additional accessories — first to go when time is short
  0 [SKIP FREELY]  Optional slots (marked ⚠ OPTIONAL SLOT above) — omit entirely when the session is full or the dominant pattern already covers the movement. Better to skip an optional slot than to fill it with a low-value exercise.

${skillCapacityNote}
Volume: Target range is ${volumePerSession.min}–${volumePerSession.max} items per session. Hard max ${volumePerSession.max} must never be exceeded. Soft min ${volumePerSession.min} should always be reached — fill spare capacity with valid support/core work.

EXERCISE SELECTION:
- For each movement pattern, use Working set as the main exercise.
- Add 2 sets of Hard set (isHardSet: true, lower reps) only if volume budget allows — this is a priority-5 item.
- Consult the PERFORMANCE SIGNALS section for exercise-specific guidance. Follow those signals when data is available. If no signal exists for an exercise, use conservative defaults (maintain current prescription and working-set selection).
- Exercise names must exactly match names from the Allowed pool. Do not invent names or use exercises outside the Allowed pool.
- The "name" field must be the exact canonical exercise name — no suffixes, no appended descriptions, no dash-notes. Write "Tuck front lever" NOT "Tuck front lever — sub-max hold sets". Write "Pull-up" NOT "Pull-up — working set". The name field is a key, not a label.
- The Allowed pool is already pre-filtered for this user's level. Exercises not listed are either too regressed or need different equipment. Do not reach outside the pool even for warm-up — regression exercises are excluded intentionally.
- For support and accessory sets, prefer exercises from the Support range (listed per slot). These are the level-appropriate choices. Exercises in the pool but above the support range are reserved for the hard set / next-level exposure only.
- Peer alternatives (listed per slot and per skill goal) are same-difficulty peers derived from the skill tree — they are NOT progressions. Use them for variety in support/accessory work or when a close variation better fits the session pattern. NEVER use a peer alternative as the Working set or as the primary skill block — progression tracking requires the exact current step.

NEAR-DUPLICATE RULE:
- "Near-duplicate" pairs are listed per slot as "Near-dupes". These exercises are peer alternatives or same-branch close progressions that serve the same mechanical purpose at similar difficulty.
- Do NOT use both exercises from a near-duplicate cluster in the same session in the same role (e.g. both as accessory sets, or both as working-level sets).
- Using them in clearly different roles within the same session IS fine: skill work + support, hard-set (next level) + working set, or foundation warm-up + main lift.
- Same movement pattern from different slots is intentional (e.g. front lever + row variation, or pistol squat skill work + a leg accessory) — do not treat cross-slot same-pattern combinations as near-duplicates.
- ROW FAMILY (strict): Horizontal Pull exercises (all inverted row variants, Ring row, Weighted inverted row) train the same horizontal pulling pattern. Use at most ONE per pull session regardless of role. Replace a second row with a vertical pull, core, or skill-support exercise.

SKILL WORK — ARRAY SEPARATION (HARD RULE):
There are two output arrays. Each exercise goes in exactly ONE — never both, never swapped.

  skillWork[]  — skill progression holds/drills ONLY  (isSkillWork: true)
               These are the "Current step" exercises from SKILL GOALS above.
${skillGoals.length > 0
  ? skillGoals.map(sg => `               • "${sg.currentStepName}"  →  ${sg.session.toUpperCase()} session`).join("\n")
  : "               None — no active skill goals."}

  exercises[]  — Allowed pool exercises ONLY  (isSkillWork: false)
               These come from the Movement Slots section above.
               Skill step names listed above must NEVER appear in exercises[].

If you place a skill step name in exercises[] it is a hard error. Move it to skillWork[].
If you place an Allowed pool exercise in skillWork[] it is a hard error. Move it to exercises[].

Placement rules:
- skillWork[] goes at the START of every Pull, Push, and Legs session. Skip on Full Body days.
- Within skillWork[], the primary goal step must be listed FIRST.
- Regressions and foundation drills are NOT skill steps — they belong in exercises[].
- Use the exact Prescription shown per goal. Do not invent sets or reps.

SESSION STRUCTURE:
- Pull day: [primary skill work] → 1–2 vertical pull + 1 horizontal pull + 1 core
- Push day: [primary skill work] → 1 vertical push + 1 horizontal push + 1–2 dips + 1 core
- Legs day: [primary skill work] → 2–3 leg exercises + 1 nordic (if available) + 1–2 core
- Full Body: 1 pull + 1 push + 1 dip or legs + 1 core (no skill work, 4–5 exercises)
- Count skillWork + exercises together. Target ${volumePerSession.min}–${volumePerSession.max} items. Never exceed ${volumePerSession.max}. Aim for at least ${volumePerSession.min}.

OPTIONAL SLOT RULE: Any slot marked ⚠ OPTIONAL SLOT should be skipped when the session is already at a good level of quality and volume. But if skipping it would leave the session below the soft minimum (${volumePerSession.min} items), do NOT leave the day short — fill the remaining capacity with a different valid exercise from the Allowed pool (support/core/accessory). A good substitute at the right level is always better than an underfilled session.

SAME-CATEGORY SESSION VARIATION:
- When multiple days share a session type (Pull/Push/Legs), follow the per-day emphasis from the SESSION EMPHASIS section above exactly. Those notes are the authoritative guide.
- Both sessions must cover all required pattern slots for their session type — variation is by volume and intensity, not by removing patterns.

━━━ OUTPUT FORMAT ━━━
Return RAW JSON only.
- The very first character of your response must be { and the last must be }
- No markdown fences (no \`\`\`json, no \`\`\`)
- No explanations, preamble, or trailing text
- No JavaScript-style comments (// or /* */)
- All strings must be properly closed with matching double-quotes
- No trailing commas

REMINDER: "skillWork" contains ONLY skill step names from SKILL GOALS. "exercises" contains ONLY Allowed pool exercises. These arrays must never be swapped or mixed.

Required shape (return exactly 7 days, Monday–Sunday):
{
  "days": [
    {
      "day": "Monday",
      "type": "training",
      "focus": "Pull — Back & Core",
      "skillWork": [
        { "name": "Tuck front lever", "sets": 4, "reps": "Max sec", "isHardSet": false, "isSkillWork": true }
      ],
      "exercises": [
        { "name": "Pull-up", "sets": 4, "reps": "6–8", "isHardSet": false, "isSkillWork": false },
        { "name": "Explosive pull-up", "sets": 2, "reps": "3–4", "isHardSet": true, "isSkillWork": false }
      ]
    },
    { "day": "Tuesday", "type": "rest" }
  ],
  "note": "2-sentence coaching note for this specific week."
}

Rest days must have only "day" and "type" fields. Training days must have "focus", "exercises" (non-empty), and optionally "skillWork".`;
}

// ─── Shape validation ─────────────────────────────────────────────────────────

function parseExercise(raw: unknown, fallbackIsSkillWork = false): Exercise {
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
    isSkillWork: Boolean(e.isSkillWork ?? fallbackIsSkillWork),
    ...(typeof e.progressionNote === "string" ? { progressionNote: e.progressionNote } : {}),
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
      exercises: (dd.exercises as unknown[]).map(ex => parseExercise(ex, false)),
      skillWork: Array.isArray(dd.skillWork)
        ? (dd.skillWork as unknown[]).map(ex => parseExercise(ex, true))
        : [],
    };
  });

  return { days, note: d.note };
}

// ─── Pro-plan constraint validation ──────────────────────────────────────────
// Checks the Gemini-generated plan against the deterministic PlannerInput.
// Returns a list of violations. Any violation means Gemini ignored a constraint;
// the caller throws so the existing catch-block falls through to the TS fallback.
//
// Rules:
//   1. Exercises validated against the allowed pool for that day's session type,
//      not just any pool from the whole week.
//      · Pull / Push / Legs days: only slots matching that session type are valid,
//        plus core slots (all session types include a core exercise per the prompt).
//      · Full Body days (or unknown focus): all pools accepted.
//      · Skill work entries validated against skill-goal step names for the same
//        session type; Full Body days accept any goal's step name.
//   2. Session total (skillWork + exercises) does not exceed volumePerSession.max.
//   3. Primary goal (priority 1) skill work must appear in every dedicated session
//      for that goal's session type (fires when weeklyDedicatedSessions > 0).
//   5. [Week-level] When weeklyDedicatedSessions === 0 (full-body schedule), primary
//      goal skill work must appear at least once anywhere in the week — in either
//      skillWork or exercises on any training day.
//   4. When primarySkillWorkOnly = true, secondary goal step names must not appear
//      in any skillWork array.

interface PlanViolation {
  rule:   string;
  day?:   string;
  detail: string;
}

function focusToSessionType(focus: string | undefined): "pull" | "push" | "legs" | "fullbody" | null {
  if (!focus) return null;
  const f = focus.toLowerCase();
  // Primary: model is told to use these exact prefixes in the prompt
  if (f.includes("pull"))                           return "pull";
  if (f.includes("push"))                           return "push";
  if (f.includes("legs"))                           return "legs";
  if (f.includes("full body"))                      return "fullbody";
  // Secondary: catch fallback focus strings the model occasionally produces
  // without the required session-type prefix (e.g. "Back & Core" not "Pull — Back & Core")
  if (f.includes("back") || f.includes("row"))      return "pull";
  if (f.includes("chest") || f.includes("shoulder")) return "push";
  if (f.includes("leg") || f.includes("squat"))     return "legs";
  return null;
}

/**
 * Builds the allowed exercise and skill-work name sets for a single training day.
 *
 * exercisePool — valid names for the `exercises` array:
 *   · Slots whose session type matches (or is "core", which is always allowed).
 *   · On Full Body / unknown days every slot is included, plus all skill step
 *     names (Gemini may place skill work in exercises on Full Body days).
 *
 * skillPool — valid names for the `skillWork` array:
 *   · Step names of goals whose session type matches.
 *   · On Full Body / unknown days all goal step names are accepted.
 */
function buildDayPools(
  sessionType: "pull" | "push" | "legs" | "fullbody" | null,
  workoutSlots: ReturnType<typeof buildPlannerInput>["workoutSlots"],
  skillGoals:   ReturnType<typeof buildPlannerInput>["skillGoals"],
): { exercisePool: Set<string>; skillPool: Set<string> } {
  const exercisePool = new Set<string>();
  const skillPool    = new Set<string>();

  const isOpenDay = sessionType === "fullbody" || sessionType === null;

  for (const slot of workoutSlots) {
    const include = isOpenDay || slot.session === sessionType || slot.session === "core";
    if (include) for (const name of slot.allowedPool) exercisePool.add(name.toLowerCase());
  }

  for (const sg of skillGoals) {
    const matchesDay = isOpenDay || sg.session === sessionType;
    if (matchesDay) skillPool.add(sg.currentStepName.toLowerCase());
    // Full Body / unknown days: skill steps may appear in exercises too
    if (isOpenDay) exercisePool.add(sg.currentStepName.toLowerCase());
  }

  return { exercisePool, skillPool };
}

function validateProPlan(plan: WeeklyPlan, input: PlannerInput): PlanViolation[] {
  const violations: PlanViolation[] = [];
  const { workoutSlots, skillGoals, volumePerSession, primarySkillWorkOnly } = input;

  const primaryGoal = skillGoals.find(sg => sg.priority === 1);
  const secondaryStepNamesLower = new Set(
    skillGoals.filter(sg => sg.priority > 1).map(sg => sg.currentStepName.toLowerCase()),
  );

  // ── Rule 5 (week-level): primary skill work on full-body schedules ─────────
  // When weeklyDedicatedSessions === 0 for the primary goal, rule 3's per-day
  // guard never fires. Require the step to appear at least once anywhere in the
  // week (skillWork or exercises — Gemini may use either on Full Body days).
  if (primaryGoal && primaryGoal.weeklyDedicatedSessions === 0) {
    const primaryStepLower = primaryGoal.currentStepName.toLowerCase();
    const appearsInWeek = plan.days
      .filter(d => d.type === "training")
      .some(d =>
        [...(d.skillWork ?? []), ...(d.exercises ?? [])].some(
          ex => ex.name.toLowerCase() === primaryStepLower,
        ),
      );
    if (!appearsInWeek) {
      violations.push({
        rule:   "missing-primary-skill-work-fullbody-schedule",
        detail: `Primary skill work "${primaryGoal.currentStepName}" does not appear anywhere in the week`,
      });
    }
  }

  for (const day of plan.days) {
    if (day.type === "rest") continue;

    const sessionType               = focusToSessionType(day.focus);
    const { exercisePool, skillPool } = buildDayPools(sessionType, workoutSlots, skillGoals);

    // ── Rule 1: exercises against this day's session-type pool ─────────────
    // Build a set of regressed names for this day to give a specific violation message.
    const regressedForDay = new Set<string>();
    for (const slot of workoutSlots) {
      const include = sessionType === "fullbody" || sessionType === null
        || slot.session === sessionType || slot.session === "core";
      if (include) {
        for (const name of slot.regressedPool) regressedForDay.add(name.toLowerCase());
      }
    }

    for (const ex of (day.exercises ?? [])) {
      const nameLower = ex.name.toLowerCase();
      if (!exercisePool.has(nameLower)) {
        const isRegressed = regressedForDay.has(nameLower);
        violations.push({
          rule: isRegressed ? "regressed-exercise-as-main-work" : "exercise-wrong-session-type",
          day:  day.day,
          detail: isRegressed
            ? `"${ex.name}" is too regressed for this user's level and must not appear as a main/support lift`
            : `"${ex.name}" not in allowed pool for ${sessionType ?? "unknown"} session`,
        });
      }
    }

    // ── Rule 1b: skill work against this day's session-type skill steps ────
    for (const ex of (day.skillWork ?? [])) {
      if (!skillPool.has(ex.name.toLowerCase())) {
        violations.push({
          rule:   "skill-work-wrong-session-type",
          day:    day.day,
          detail: `Skill work "${ex.name}" not valid for ${sessionType ?? "unknown"} session`,
        });
      }
    }

    // ── Rule 1c: skill step placed in exercises[] instead of skillWork[] ────
    // Only fires on dedicated session days (pull/push/legs); Full Body days
    // allow skill steps in exercises[] by design.
    if (sessionType !== "fullbody" && sessionType !== null) {
      const skillStepsForSession = new Set(
        skillGoals
          .filter(sg => sg.session === sessionType)
          .map(sg => sg.currentStepName.toLowerCase()),
      );
      for (const ex of (day.exercises ?? [])) {
        if (skillStepsForSession.has(ex.name.toLowerCase())) {
          violations.push({
            rule:   "skill-exercise-in-wrong-array",
            day:    day.day,
            detail: `"${ex.name}" is a skill progression step — move it from exercises[] to skillWork[]`,
          });
        }
      }
    }

    // ── Rule 2: volume does not exceed max ─────────────────────────────────
    const total = (day.skillWork ?? []).length + (day.exercises ?? []).length;
    if (total > volumePerSession.max) {
      violations.push({
        rule:   "volume-over-budget",
        day:    day.day,
        detail: `${total} exercises exceeds session max of ${volumePerSession.max}`,
      });
    }

    // ── Rule 3: primary skill work in every dedicated session ──────────────
    if (
      primaryGoal &&
      primaryGoal.weeklyDedicatedSessions > 0 &&
      sessionType === primaryGoal.session &&
      sessionType !== "fullbody"
    ) {
      const present = (day.skillWork ?? []).some(
        ex => ex.name.toLowerCase() === primaryGoal.currentStepName.toLowerCase(),
      );
      if (!present) {
        violations.push({
          rule:   "missing-primary-skill-work",
          day:    day.day,
          detail: `Primary skill work "${primaryGoal.currentStepName}" missing from ${primaryGoal.session} session`,
        });
      }
    }

    // ── Rule 4: secondary skill work excluded when primarySkillWorkOnly ────
    if (primarySkillWorkOnly && secondaryStepNamesLower.size > 0) {
      for (const ex of (day.skillWork ?? [])) {
        if (secondaryStepNamesLower.has(ex.name.toLowerCase())) {
          violations.push({
            rule:   "secondary-skill-work-not-allowed",
            day:    day.day,
            detail: `"${ex.name}" is secondary goal skill work, excluded at ${input.sessionLength} min`,
          });
        }
      }
    }

    // ── Rule 6: near-duplicate clusters — only one non-working-set member allowed ─
    // Uses transitive-closure groups (not raw pairs) so a 3-way cluster fires one
    // violation naming all members.
    //
    // Working Set exemption: the slot's Working Set exercise is always allowed
    // regardless of cluster membership. The violation only fires when 2+ exercises
    // that are NOT the Working Set from the same cluster appear together in exercises[].
    // This allows "Working Set + one accessory from the cluster" (e.g. Explosive push-up
    // as main + Diamond push-up as accessory) while still blocking two accessories
    // from the same cluster (Diamond + Decline) which add no variety.
    const isOpenDay2 = sessionType === "fullbody" || sessionType === null;
    const exercisesLower = new Set((day.exercises ?? []).map(ex => ex.name.toLowerCase()));

    // Build the set of Working Set exercise names for this day's session type
    const workingSetsForDay = new Set<string>();
    for (const slot of workoutSlots) {
      const include = isOpenDay2 || slot.session === sessionType || slot.session === "core";
      if (include) workingSetsForDay.add(slot.workingSet.toLowerCase());
    }

    const seenGroupKeys = new Set<string>();

    for (const slot of workoutSlots) {
      const include = isOpenDay2 || slot.session === sessionType || slot.session === "core";
      if (!include) continue;
      for (const group of slot.nearDuplicateGroups) {
        const groupKey = [...group].map(n => n.toLowerCase()).sort().join("||");
        if (seenGroupKeys.has(groupKey)) continue;
        seenGroupKeys.add(groupKey);

        // Horizontal Pull is strict: all row-family exercises serve nearly the same
        // mechanical role, so even Working Set + one row accessory is redundant.
        // All other slots use the Working Set exemption (e.g. push-up family where
        // Working Set + one accessory at a different angle is intentionally varied).
        const isStrictSlot = slot.pattern === "Horizontal Pull";
        const presentCandidates = isStrictSlot
          ? group.filter(n => exercisesLower.has(n.toLowerCase()))
          : group.filter(n => exercisesLower.has(n.toLowerCase()) && !workingSetsForDay.has(n.toLowerCase()));

        if (presentCandidates.length >= 2) {
          violations.push({
            rule:   "near-duplicate-in-exercises",
            day:    day.day,
            detail: isStrictSlot
              ? `Row-family cluster [${group.join(", ")}] — use at most one row variation per session. Present: ${presentCandidates.map(n => `"${n}"`).join(", ")}. Keep the Working set row; replace the other(s) with a vertical pull, core, or skill-support exercise.`
              : `Near-duplicate cluster [${group.join(", ")}] — only one non-working-set member allowed per session. Present as accessories: ${presentCandidates.map(n => `"${n}"`).join(", ")}. Keep one; replace the other(s) with a different movement family — do NOT substitute another member of the same cluster.`,
          });
        }
      }
    }

    // ── Rule 7: cross-slot near-duplicate clusters ─────────────────────────────
    const { sessionNearDuplicateClusters } = input;
    const seenCrossSlotKeys = new Set<string>();
    for (const cluster of sessionNearDuplicateClusters) {
      const groupKey = [...cluster].map(n => n.toLowerCase()).sort().join("||");
      if (seenCrossSlotKeys.has(groupKey)) continue;
      seenCrossSlotKeys.add(groupKey);
      // Same Working Set exemption as Rule 6
      const presentAsAccessory = cluster.filter(
        n => exercisesLower.has(n.toLowerCase()) && !workingSetsForDay.has(n.toLowerCase()),
      );
      if (presentAsAccessory.length >= 2) {
        violations.push({
          rule:   "near-duplicate-in-exercises",
          day:    day.day,
          detail: `Cross-slot near-duplicate cluster [${cluster.join(", ")}] — peer alternatives from different pattern slots. Only one allowed per session. Present: ${presentAsAccessory.map(n => `"${n}"`).join(", ")}. Keep one; replace the other(s) with a different movement — do NOT substitute another cluster member.`,
        });
      }
    }
  }

  return violations;
}

// ─── Skill-step relocation ───────────────────────────���────────────────────────
// Deterministic cleanup pass that runs after JSON parsing, before constraint
// validation. If Gemini placed a skill progression step in exercises[] on a
// dedicated session day, this moves it to skillWork[] instead of letting
// Rule 1c fire and burning a retry on a straightforward array-assignment error.
//
// Full Body days are intentionally skipped — skill steps may live in exercises[]
// on those days by design. Deduplication prevents double-adding a step that was
// already correctly placed in skillWork[].

function relocateMisplacedSkillSteps(plan: WeeklyPlan, input: PlannerInput): WeeklyPlan {
  const skillStepsBySession = new Map<string, Set<string>>();
  for (const sg of input.skillGoals) {
    if (!skillStepsBySession.has(sg.session)) skillStepsBySession.set(sg.session, new Set());
    skillStepsBySession.get(sg.session)!.add(sg.currentStepName.toLowerCase());
  }

  const days = plan.days.map(day => {
    if (day.type === "rest") return day;

    const sessionType = focusToSessionType(day.focus);
    if (!sessionType || sessionType === "fullbody") return day; // Full Body: allowed by design

    const stepsForSession = skillStepsBySession.get(sessionType);
    if (!stepsForSession || stepsForSession.size === 0) return day;

    const toRelocate: Exercise[] = [];
    const remainingExercises: Exercise[] = [];

    for (const ex of (day.exercises ?? [])) {
      if (stepsForSession.has(ex.name.toLowerCase())) {
        toRelocate.push({ ...ex, isSkillWork: true });
      } else {
        remainingExercises.push(ex);
      }
    }

    if (toRelocate.length === 0) return day;

    // Don't duplicate a step already present in skillWork[]
    const existingSkillNames = new Set((day.skillWork ?? []).map(s => s.name.toLowerCase()));
    const newSkillSteps = toRelocate.filter(ex => !existingSkillNames.has(ex.name.toLowerCase()));

    // Place relocated steps at the front so the primary skill goal stays first
    return {
      ...day,
      exercises: remainingExercises,
      skillWork: [...newSkillSteps, ...(day.skillWork ?? [])],
    };
  });

  return { ...plan, days };
}

// ─── Canonical-name normalization ────────────────────────────────────────────
// Gemini sometimes appends descriptive suffixes inside the name field
// (e.g. "Tuck front lever — sub-max hold sets"). Strip those before constraint
// validation using prefix-matching against the known canonical name set.
//
// Safety guarantee: exact-match is always tried first, so a legitimate name like
// "Decline pike — parallettes" is returned as-is even though it contains " — ".

function buildCanonicalNames(input: PlannerInput): Set<string> {
  const names = new Set<string>();
  for (const slot of input.workoutSlots) {
    for (const name of slot.allowedPool) names.add(name);
  }
  for (const sg of input.skillGoals) names.add(sg.currentStepName);
  return names;
}

function normalizeExerciseName(raw: string, canonicals: Set<string>): string {
  // 1. Exact match (case-insensitive) — always wins
  for (const c of canonicals) {
    if (c.toLowerCase() === raw.toLowerCase()) return c;
  }
  // 2. Prefix match — strip " — ..." or " - ..." suffix appended by the model
  const lc = raw.toLowerCase();
  for (const c of canonicals) {
    if (lc.startsWith(c.toLowerCase() + " \u2014 ") || lc.startsWith(c.toLowerCase() + " - ")) {
      return c;
    }
  }
  return raw;
}

function normalizePlanNames(plan: WeeklyPlan, input: PlannerInput): WeeklyPlan {
  const canonicals = buildCanonicalNames(input);
  const days = plan.days.map(day => {
    if (day.type === "rest") return day;
    return {
      ...day,
      skillWork: (day.skillWork ?? []).map(ex => ({
        ...ex,
        name: normalizeExerciseName(ex.name, canonicals),
      })),
      exercises: (day.exercises ?? []).map(ex => ({
        ...ex,
        name: normalizeExerciseName(ex.name, canonicals),
      })),
    };
  });
  return { ...plan, days };
}

// ─── Swap options attachment ──────────────────────────────────────────────────
// Post-processes a validated pro plan to attach deterministic swap metadata to
// every exercise. Only runs after validateProPlan passes (Gemini plan path).
// Free-plan exercises produced by the TS fallback do not get swap options.

function attachSwapOptions(plan: WeeklyPlan, input: PlannerInput): WeeklyPlan {
  const days = plan.days.map(day => {
    if (day.type === "rest") return day;
    return {
      ...day,
      skillWork: (day.skillWork ?? []).map(ex => {
        const swapOptions = resolveSwapOptions(ex.name, true, input);
        return swapOptions ? { ...ex, swapOptions } : ex;
      }),
      exercises: (day.exercises ?? []).map(ex => {
        const swapOptions = resolveSwapOptions(ex.name, ex.isSkillWork ?? false, input);
        return swapOptions ? { ...ex, swapOptions } : ex;
      }),
    };
  });
  return { ...plan, days };
}

// ─── Violation-type correction notes ─────────────────────────────────────────
// Generates targeted "how to fix" instructions for each class of violation,
// placed above the raw violation list so Gemini knows the exact repair action.

function buildCorrectionNotes(violations: PlanViolation[]): string {
  const byRule = new Map<string, PlanViolation[]>();
  for (const v of violations) {
    const list = byRule.get(v.rule) ?? [];
    list.push(v);
    byRule.set(v.rule, list);
  }

  const lines: string[] = [];

  const wrongArray = byRule.get("skill-exercise-in-wrong-array") ?? [];
  if (wrongArray.length > 0) {
    lines.push("ARRAY FIX — move each of these from exercises[] to skillWork[]:");
    for (const v of wrongArray) lines.push(`  → [${v.day}] ${v.detail}`);
  }

  const nearDupe = byRule.get("near-duplicate-in-exercises") ?? [];
  if (nearDupe.length > 0) {
    lines.push("NEAR-DUPLICATE FIX — for each cluster violation, keep ONLY ONE exercise (the Working set for that slot). Replace ALL other cluster members with a DIFFERENT movement family — do NOT substitute another member of the same cluster:");
    for (const v of nearDupe) lines.push(`  → [${v.day}] ${v.detail}`);
  }

  const overBudget = byRule.get("volume-over-budget") ?? [];
  if (overBudget.length > 0) {
    lines.push("VOLUME FIX — trim each day to the session max (drop hard sets or optional slots first):");
    for (const v of overBudget) lines.push(`  → [${v.day}] ${v.detail}`);
  }

  const missingSkill = byRule.get("missing-primary-skill-work") ?? [];
  if (missingSkill.length > 0) {
    lines.push("MISSING SKILL WORK — add the primary skill step to skillWork[] on each day:");
    for (const v of missingSkill) lines.push(`  → [${v.day}] ${v.detail}`);
  }

  const wrongPool = [
    ...(byRule.get("exercise-wrong-session-type") ?? []),
    ...(byRule.get("regressed-exercise-as-main-work") ?? []),
  ];
  if (wrongPool.length > 0) {
    lines.push("POOL FIX — replace each exercise with one from the Allowed pool for that session type:");
    for (const v of wrongPool) lines.push(`  → [${v.day ?? "?"}] ${v.detail}`);
  }

  return lines.join("\n");
}

// ─── Retry prompt builder ─────────────────────────────────────────────────────
// Appends a correction block to the original prompt so Gemini sees both the
// constraints and its own previous (invalid) output side-by-side.

function buildRetryPrompt(
  originalPrompt:   string,
  violations:       PlanViolation[],
  previousResponse: string,
): string {
  const correctionNotes = buildCorrectionNotes(violations);
  const violationLines  = violations
    .map(v => `  • [${v.rule}${v.day ? ` – ${v.day}` : ""}] ${v.detail}`)
    .join("\n");

  return `${originalPrompt}

━━━ CORRECTION REQUIRED ━━━
Your previous response had ${violations.length} constraint violation(s).
Fix EVERY item below. Keep all days that had no violations exactly as they were.

NAME DISCIPLINE REMINDER:
Every exercise "name" must be the exact canonical name from the Allowed pool or Skill Goals.
Do NOT append suffixes like "— sub-max hold sets", "— working set", or any other note.
Use "Tuck front lever" not "Tuck front lever — sub-max hold sets".

HOW TO FIX EACH TYPE:
${correctionNotes || "  (see violation list below)"}

ALL VIOLATIONS:
${violationLines}

YOUR PREVIOUS RESPONSE (return a corrected version):
${previousResponse}`;
}

// ─── JSON repair prompt ───────────────────────────────────────────────────────
// Used when attempt 1 produces text that cannot be parsed as JSON.
// Includes the original prompt so Gemini still has the full context, plus the
// broken output so it can fix rather than regenerate from scratch.

function buildJsonRepairPrompt(
  originalPrompt: string,
  malformedText:  string,
  volumeMax?:     number,
): string {
  const volumeLine = volumeMax !== undefined
    ? `- Each training day must have at most ${volumeMax} total items (skillWork + exercises combined). Trim any day that exceeds this while repairing.\n`
    : "";
  const skillLine = `- If any skill step name (listed under "Current step" in SKILL GOALS) appears in exercises[], move it to skillWork[] instead.\n`;

  return `${originalPrompt}

━━━ JSON REPAIR REQUIRED ━━━
Your previous response could not be parsed as JSON.
Return the complete plan as a single valid JSON object — nothing else.

STRICT OUTPUT RULES (you MUST follow these):
- First character must be { and last must be }
- No markdown (no \`\`\`json, no \`\`\`)
- No explanations or text outside the JSON
- All strings properly closed with matching double-quotes
- No trailing commas, no JavaScript comments
${volumeLine}${skillLine}
YOUR PREVIOUS INVALID RESPONSE (repair the JSON, keep the plan content):
${malformedText.slice(0, 3000)}`;
}

// ─── Unified raw-plan processing pipeline ────────────────────────────────────
// Single function used by every generation path (attempt 1, JSON repair retry,
// constraint retry). Guarantees identical pipeline order and consistent logging.
//
// Pipeline: JSON.parse → shape-validate → normalize names → relocate skill steps
//
// The diagnostic warn fires when a skill step survives in exercises[] after
// relocation — most commonly caused by focusToSessionType returning null for an
// unexpected focus string. Logging it here (before validateProPlan) surfaces the
// root cause in server logs rather than leaving only the downstream violation.

function processRawPlan(rawText: string, input: PlannerInput, pathLabel: string): WeeklyPlan {
  const shaped   = validatePlan(JSON.parse(rawText));
  const named    = normalizePlanNames(shaped, input);
  const relocated = relocateMisplacedSkillSteps(named, input);

  if (input.skillGoals.length > 0) {
    const skillNamesLower = new Set(input.skillGoals.map(sg => sg.currentStepName.toLowerCase()));
    for (const day of relocated.days) {
      if (day.type !== "training") continue;
      const misplaced = (day.exercises ?? []).filter(ex => skillNamesLower.has(ex.name.toLowerCase()));
      if (misplaced.length > 0) {
        console.warn(
          `[generatePlanAI] ${pathLabel} — skill step(s) still in exercises[] after relocation [${day.day}]:`,
          {
            focus:     day.focus,
            misplaced: misplaced.map(e => e.name),
            skillWork: (day.skillWork ?? []).map(e => e.name),
            exercises: (day.exercises ?? []).map(e => e.name),
          },
        );
      }
    }
  }

  return relocated;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePlanAI(
  pullUps:       number,
  pushUps:       number,
  dips:          number,
  goal:          Goal,
  daysPerWeek:   number,
  equipment:     string[],
  weekNumber   = 1,
  skillGoals:    SkillGoal[]        = [],
  userProgress:  UserProgress[]     = [],
  recentLogs:    RecentWorkoutLog[] = [],
  sessionLength  = "60",
  previousPlan:  WeeklyPlan | null  = null,
): Promise<WeeklyPlan> {
  const eq          = buildEquipSet(equipment);
  const progressMap: Record<string, string> = {};
  for (const p of userProgress) progressMap[p.node_id] = p.status;

  const recentHistory      = buildLogsContext(recentLogs);
  const performanceSignals = buildPerformanceContext(recentLogs, previousPlan);
  const plannerInput       = buildPlannerInput(
    pullUps, pushUps, dips, goal, daysPerWeek, equipment,
    weekNumber, skillGoals, progressMap, eq, recentHistory, sessionLength, performanceSignals,
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Dev / local: no API key — TS fallback is intentional here.
    console.warn("[generatePlanAI] No GEMINI_API_KEY — using TypeScript fallback (dev only)");
    return generatePlan(pullUps, pushUps, dips, goal, daysPerWeek, equipment, weekNumber, skillGoals);
  }

  const prompt = buildProPrompt(plannerInput);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // systemInstruction reinforces JSON-only output at the model level,
    // in addition to the explicit OUTPUT FORMAT section in the prompt.
    systemInstruction: "You are a JSON generator. Your entire response must be a single valid JSON object. No markdown, no explanations, no text outside the JSON.",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens:  8192,
      temperature:      1.0,
    },
  });

  function cleanText(raw: string): string {
    return raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  }

  // ── Retry helper for transient Gemini API failures ───────────────────────
  // Gemini returns 503 "high demand" responses fairly often, especially on
  // gemini-2.5-flash. Without retries, a single transient blip kills the
  // entire plan generation request. We retry on 5xx and 429 (rate limit) and
  // network errors with exponential backoff. Other errors (4xx, auth, etc.)
  // fail fast — they aren't going to fix themselves.
  async function callGeminiWithRetry(promptText: string, label: string): Promise<string> {
    const MAX_ATTEMPTS = 4;
    const BACKOFF_MS = [800, 2000, 5000]; // delays before attempts 2, 3, 4

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(promptText);
        if (attempt > 1) {
          console.log(`[generatePlanAI] ${label} — succeeded on attempt ${attempt}/${MAX_ATTEMPTS}.`);
        }
        return cleanText(result.response.text());
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        const isRetryable =
          status === undefined || // network error / no response
          status === 429 ||       // rate limited
          (status >= 500 && status < 600);

        if (!isRetryable || attempt === MAX_ATTEMPTS) {
          break;
        }

        const delay = BACKOFF_MS[attempt - 1];
        console.warn(
          `[generatePlanAI] ${label} — attempt ${attempt}/${MAX_ATTEMPTS} failed (status ${status ?? "network"}). Retrying in ${delay}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastErr;
  }

  // ── Attempt 1: API call (with retries) ───────────────────────────────────
  let rawText1: string;
  try {
    rawText1 = await callGeminiWithRetry(prompt, "Attempt 1");
  } catch (err) {
    console.error("[generatePlanAI] Attempt 1 — API call failed after retries:", err);
    const status = (err as { status?: number })?.status;
    const userMessage =
      status === 503 || status === 429
        ? "Our AI is busy right now. Please try again in a moment."
        : "Plan generation failed. Please try again.";
    throw new ProPlanGenerationError(userMessage);
  }

  // ── Attempt 1: parse + structural validate ────────────────────────────────
  let plan1: WeeklyPlan | undefined;
  let parse1Err: unknown = null;
  try {
    plan1 = processRawPlan(rawText1, plannerInput, "Attempt 1");
  } catch (err) {
    parse1Err = err;
  }

  if (parse1Err !== null) {
    // JSON/structural failure — route to JSON repair retry instead of throwing.
    const label = parse1Err instanceof SyntaxError ? "JSON parse error" : "structural validation error";
    console.warn(
      `[generatePlanAI] Attempt 1 — ${label}: ${parse1Err instanceof Error ? parse1Err.message : parse1Err}`,
    );
    console.warn("[generatePlanAI] Attempt 1 — routing to JSON repair retry.");

    const repairPrompt = buildJsonRepairPrompt(prompt, rawText1, plannerInput.volumePerSession.max);
    let repairedPlan: WeeklyPlan;
    try {
      const r2    = await model.generateContent(repairPrompt);
      const text2 = cleanText(r2.response.text());
      repairedPlan = processRawPlan(text2, plannerInput, "JSON repair retry");
      console.log("[generatePlanAI] JSON repair retry — parse and structure OK.");
    } catch (err2) {
      const label2 = err2 instanceof SyntaxError ? "parse still failed" : "structural validation failed";
      console.error(
        `[generatePlanAI] JSON repair retry — ${label2}: ${err2 instanceof Error ? err2.message : err2}`,
      );
      throw new ProPlanGenerationError("Plan generation failed after retry. Please try again.");
    }

    const repairViolations = validateProPlan(repairedPlan, plannerInput);
    if (repairViolations.length === 0) {
      return attachSwapOptions(repairedPlan, plannerInput);
    }
    console.error(
      `[generatePlanAI] JSON repair retry — valid JSON but ${repairViolations.length} constraint violation(s). Giving up.`,
      repairViolations.map(v => `[${v.rule}${v.day ? ` – ${v.day}` : ""}] ${v.detail}`),
    );
    throw new ProPlanGenerationError("Plan generation failed after retry. Please try again.");
  }

  // ── Attempt 1: constraint validation ─────────────────────────────────────
  const violations1 = validateProPlan(plan1!, plannerInput);
  if (violations1.length === 0) {
    return attachSwapOptions(plan1!, plannerInput);
  }

  console.warn(
    `[generatePlanAI] Attempt 1 — ${violations1.length} constraint violation(s), retrying:`,
    violations1.map(v => `[${v.rule}${v.day ? ` – ${v.day}` : ""}] ${v.detail}`),
  );

  // ── Constraint correction retry ───────────────────────────────────────────
  const retryPrompt = buildRetryPrompt(prompt, violations1, rawText1);
  let plan2: WeeklyPlan;
  try {
    const r2    = await model.generateContent(retryPrompt);
    const text2 = cleanText(r2.response.text());
    plan2 = processRawPlan(text2, plannerInput, "Constraint retry");
  } catch (err) {
    const label = err instanceof SyntaxError ? "JSON parse failed" : "structural validation failed";
    console.error(
      `[generatePlanAI] Constraint retry — ${label}: ${err instanceof Error ? err.message : err}`,
    );
    throw new ProPlanGenerationError("Plan generation failed after retry. Please try again.");
  }

  const violations2 = validateProPlan(plan2, plannerInput);
  if (violations2.length === 0) {
    console.log("[generatePlanAI] Constraint retry — succeeded.");
    return attachSwapOptions(plan2, plannerInput);
  }

  console.error(
    `[generatePlanAI] Constraint retry — ${violations2.length} violation(s) remain. Giving up.`,
    violations2.map(v => `[${v.rule}${v.day ? ` – ${v.day}` : ""}] ${v.detail}`),
  );
  throw new ProPlanGenerationError("Plan generation failed after retry. Please try again.");
}

// ─── Profile-based entry point (called from /api/plan/generate) ───────────────

export async function generatePlanFromProfile(
  profile: {
    level:           string;
    goal:            string;
    days_per_week?:  number | null;
    equipment?:      string[] | null;
    created_at?:     string | null;
    session_length?: string | null;
  },
  skillGoals:   SkillGoal[]        = [],
  userProgress: UserProgress[]     = [],
  recentLogs:   RecentWorkoutLog[] = [],
  previousPlan: WeeklyPlan | null  = null,
): Promise<WeeklyPlan> {
  const weekNumber = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : 1;

  const progressMap: Record<string, string> = {};
  for (const p of userProgress) progressMap[p.node_id] = p.status;

  // Primary: derive rep context from saved tree state.
  // Fallback: profile-level approximation for users with no saved progress.
  const reps = Object.keys(progressMap).length > 0
    ? repsFromProgress(progressMap)
    : LEVEL_REPS[profile.level] ?? LEVEL_REPS["Beginner"];

  return generatePlanAI(
    reps.pullUps, reps.pushUps, reps.dips,
    profile.goal as Goal,
    profile.days_per_week ?? 3,
    profile.equipment ?? [],
    weekNumber,
    skillGoals,
    userProgress,
    recentLogs,
    profile.session_length ?? "60",
    previousPlan,
  );
}
