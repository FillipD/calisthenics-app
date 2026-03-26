# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured.

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in:
- `BEEHIIV_API_KEY` — beehiiv API key
- `BEEHIIV_PUBLICATION_ID` — beehiiv publication ID (format: `pub_*`)

## Architecture

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS. Deployed on Vercel.

**Data flow:**
1. User submits form with pull-up/push-up/dip counts, a goal, and email
2. `POST /api/subscribe` receives the data server-side
3. `assessUser()` (`lib/assess.ts`) scores reps into strength categories → fitness level (Beginner / Beginner+ / Novice)
4. `generatePlan()` (`lib/plan.ts`) builds a 7-day plan keyed on `(level, goal)`
5. beehiiv subscription is triggered server-side (API key never exposed to client)
6. Response returns the plan and a summary string to the frontend

**Key files:**
- `app/api/subscribe/route.ts` — the only API route; handles validation, assessment, plan generation, and beehiiv subscription
- `lib/assess.ts` — fitness level assessment logic
- `lib/plan.ts` — 7-day plan generator (4 training days + 3 rest days; goal variants: `lose-weight`, `build-muscle`, `build-muscle-lose-weight`)
- `types/index.ts` — shared TypeScript types for the entire app

**Styling:** Tailwind CSS with custom design tokens defined in `globals.css`:
- `chalk` (#f5f0e8), `ink` (#1a1a18), `muscle` (#c8f04a), `rust` (#e05a2b), `mid` (#6b6b60)
- Fonts: Syne (display), DM Sans (body)

**Path alias:** `@/*` maps to the project root.
