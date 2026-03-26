# Calisthenics Starter — MVP

A clean landing page for beginner calisthenics. Users enter their max reps,
choose a goal, and receive a personalised 1-week training plan. Their email
is subscribed to your beehiiv newsletter automatically.

---

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- beehiiv API (server-side only)
- Vercel (deployment)

---

## Local setup (step by step)

### 1. Make sure you have Node.js installed
Download from https://nodejs.org — choose the LTS version.
Check it works: open a terminal and run `node -v`

### 2. Open the project in WebStorm
File → Open → select this folder

### 3. Install dependencies
Open the terminal inside WebStorm (View → Tool Windows → Terminal) and run:

```bash
npm install
```

### 4. Set up your environment variables
Duplicate the example file and fill in your beehiiv details:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and replace the placeholder values with your real keys.

**Where to find your beehiiv keys:**
- Log into beehiiv.com
- API Key: Settings → Integrations → API → Create key
- Publication ID: Settings → Publication (starts with `pub_`)

### 5. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Deploy to Vercel

### Step 1 — Push to GitHub
1. Create a free account at github.com
2. Create a new repository called `calisthenics-app`
3. In your terminal:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/calisthenics-app.git
git push -u origin main
```

### Step 2 — Connect Vercel
1. Go to vercel.com and sign up with your GitHub account
2. Click Add New → Project
3. Import your `calisthenics-app` repository
4. Click Deploy — Vercel auto-detects Next.js

### Step 3 — Add your secret keys on Vercel
1. In your Vercel project → Settings → Environment Variables
2. Add:
   - `BEEHIIV_API_KEY` = your beehiiv API key
   - `BEEHIIV_PUBLICATION_ID` = your beehiiv publication ID
3. Click Save → go to Deployments → Redeploy

Your site is now live!

---

## beehiiv custom fields (optional but recommended)
To store goal and level on each subscriber in beehiiv:
1. beehiiv Dashboard → Subscribers → Custom Fields
2. Create a text field named `goal`
3. Create a text field named `level`

If you skip this, subscriptions still work — these fields are just ignored.

---

## Project structure

```
app/
  api/subscribe/route.ts   ← Server API: calls beehiiv, returns plan
  globals.css              ← Global styles
  layout.tsx               ← Root HTML layout
  page.tsx                 ← Landing page + results screen
lib/
  assess.ts                ← Level calculation logic
  plan.ts                  ← 7-day training plan generator
types/
  index.ts                 ← Shared TypeScript types
.env.local.example         ← Template for your secret keys
```

---

## Customising the plan
- Edit level thresholds: `lib/assess.ts`
- Edit exercises, sets, reps: `lib/plan.ts`
- Edit the page design: `app/page.tsx`
