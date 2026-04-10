import Link from "next/link";

const S = {
  bg:          "#0f0f0e",
  surface:     "#1a1a18",
  border:      "#2e2e2b",
  white:       "#f5f0e8",
  muted:       "#7a7a6e",
  mutedLight:  "#a0a090",
  muscle:      "#c8f04a",
};

export const metadata = {
  title: "Privacy Policy — CaliPlan",
  description: "How CaliPlan collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "3.5rem 1.25rem 4rem" }}>
      <article style={{ maxWidth: "680px", margin: "0 auto", color: S.mutedLight, lineHeight: 1.7, fontSize: "0.95rem" }}>

        <Link href="/" style={{ display: "inline-block", marginBottom: "2rem", fontSize: "0.8rem", color: S.muted, textDecoration: "none" }}>
          ← Back home
        </Link>

        <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
          Privacy
        </p>
        <h1 className="font-display" style={{ margin: "0 0 0.5rem", fontSize: "2.25rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Privacy Policy
        </h1>
        <p style={{ margin: "0 0 2rem", fontSize: "0.8rem", color: S.muted }}>
          Last updated: April 10, 2026
        </p>

        <p style={{ margin: "0 0 2rem" }}>
          This policy explains what data CaliPlan collects, why we collect it, who we share it with, and what rights you have over it. We&apos;ve kept it short and in plain English.
        </p>

        <h2 style={H2}>Who operates CaliPlan</h2>
        <p style={P}>
          CaliPlan is operated by <strong style={{ color: S.white }}>Manly Prime</strong> (CVR 43013963), based in Denmark.
          You can reach us at <a href="mailto:fillipdavidsen@gmail.com" style={A}>fillipdavidsen@gmail.com</a>.
        </p>

        <h2 style={H2}>What we collect</h2>
        <p style={P}><strong style={{ color: S.white }}>When you create an account:</strong></p>
        <ul style={UL}>
          <li>Email address (handled by Clerk, our authentication provider)</li>
          <li>Your name, if you choose to provide it during signup</li>
        </ul>

        <p style={P}><strong style={{ color: S.white }}>When you complete the assessment or pro onboarding:</strong></p>
        <ul style={UL}>
          <li>Your training experience (max pull-ups, push-ups, dips)</li>
          <li>Your goals (build strength, build muscle, or both)</li>
          <li>Equipment available to you</li>
          <li>How many days per week you want to train</li>
          <li>For pro users: detailed skill checkpoints (e.g. handstand level, planche progression)</li>
        </ul>

        <p style={P}><strong style={{ color: S.white }}>When you use the app:</strong></p>
        <ul style={UL}>
          <li>Workout logs you submit (sets, reps, dates)</li>
          <li>Plans we generate for you</li>
          <li>Account preferences and settings</li>
          <li>Sign-in metadata such as IP address and browser type (handled by Clerk)</li>
        </ul>

        <p style={P}><strong style={{ color: S.white }}>When you subscribe:</strong></p>
        <ul style={UL}>
          <li>Payment details are handled entirely by Stripe — we never see or store your card number</li>
          <li>We store your Stripe customer ID and subscription ID so we know your plan status</li>
        </ul>

        <h2 style={H2}>Why we collect it</h2>
        <ul style={UL}>
          <li>To generate personalized training plans tailored to your level and goals</li>
          <li>To save your progress and adapt your plan over time</li>
          <li>To process subscriptions and grant pro access</li>
          <li>To respond to support requests</li>
          <li>To keep the service running and prevent abuse</li>
        </ul>

        <h2 style={H2}>Who we share it with</h2>
        <p style={P}>
          We use these third-party services to operate CaliPlan. Each has its own privacy policy:
        </p>
        <ul style={UL}>
          <li><strong style={{ color: S.white }}>Clerk</strong> — user authentication and session management</li>
          <li><strong style={{ color: S.white }}>Supabase</strong> — database storage for profiles, plans, logs, and progress</li>
          <li><strong style={{ color: S.white }}>Stripe</strong> — payment processing and subscription billing</li>
          <li><strong style={{ color: S.white }}>Google Gemini</strong> — AI generation of personalized weekly plans (pro users only)</li>
          <li><strong style={{ color: S.white }}>Resend</strong> — email delivery (e.g. sending free assessment results)</li>
          <li><strong style={{ color: S.white }}>Vercel</strong> — application hosting</li>
        </ul>
        <p style={P}>
          We do not sell your data, and we do not share it with advertisers or marketing networks.
        </p>

        <h2 style={H2}>How long we keep your data</h2>
        <p style={P}>
          We keep your account data for as long as your account exists. If you delete your account, we delete your profile and associated data within 30 days. Some records may be retained longer where required by law (for example, invoices and payment records for tax purposes).
        </p>

        <h2 style={H2}>Your rights</h2>
        <p style={P}>
          Because we are based in Denmark and operate under EU/EEA law, you have the following rights regarding your personal data:
        </p>
        <ul style={UL}>
          <li><strong style={{ color: S.white }}>Access</strong> — request a copy of the data we hold about you</li>
          <li><strong style={{ color: S.white }}>Correction</strong> — ask us to fix anything that&apos;s wrong</li>
          <li><strong style={{ color: S.white }}>Deletion</strong> — ask us to delete your account and your data</li>
          <li><strong style={{ color: S.white }}>Portability</strong> — request your data in a portable format</li>
          <li><strong style={{ color: S.white }}>Withdraw consent</strong> — at any time, with no consequence to past use of the service</li>
          <li><strong style={{ color: S.white }}>Complain</strong> — to your local data protection authority (in Denmark, this is Datatilsynet)</li>
        </ul>
        <p style={P}>
          To exercise any of these rights, email <a href="mailto:fillipdavidsen@gmail.com" style={A}>fillipdavidsen@gmail.com</a>.
        </p>

        <h2 style={H2}>Cookies</h2>
        <p style={P}>
          CaliPlan uses essential cookies for authentication (set by Clerk) and for payment session handling (set by Stripe during checkout). We do not use tracking, advertising, or analytics cookies.
        </p>

        <h2 style={H2}>Children</h2>
        <p style={P}>
          CaliPlan is not intended for users under 16. If you are under 16, please do not create an account.
        </p>

        <h2 style={H2}>Changes to this policy</h2>
        <p style={P}>
          If we make material changes to this policy, we&apos;ll update the &ldquo;Last updated&rdquo; date at the top and, for existing users, notify you by email or through the app.
        </p>

        <h2 style={H2}>Contact</h2>
        <p style={P}>
          Privacy questions or requests: <a href="mailto:fillipdavidsen@gmail.com" style={A}>fillipdavidsen@gmail.com</a>
        </p>

        <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: `1px solid ${S.border}`, display: "flex", gap: "1.5rem", fontSize: "0.8rem" }}>
          <Link href="/terms" style={{ color: S.muted, textDecoration: "none" }}>Terms</Link>
          <Link href="/contact" style={{ color: S.muted, textDecoration: "none" }}>Contact</Link>
          <Link href="/" style={{ color: S.muted, textDecoration: "none" }}>Home</Link>
        </div>
      </article>
    </main>
  );
}

// Shared inline style snippets — kept here so the file is self-contained
const H2: React.CSSProperties = {
  margin: "2rem 0 0.75rem",
  fontSize: "1.15rem",
  fontWeight: 700,
  color: S.white,
  letterSpacing: "-0.01em",
};

const P: React.CSSProperties = {
  margin: "0 0 1rem",
};

const UL: React.CSSProperties = {
  margin: "0 0 1.25rem 1.25rem",
  padding: 0,
};

const A: React.CSSProperties = {
  color: S.muscle,
  textDecoration: "none",
  borderBottom: `1px solid ${S.muscle}`,
};
