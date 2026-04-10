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
  title: "Contact — CaliPlan",
  description: "Get in touch with the CaliPlan team.",
};

export default function ContactPage() {
  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "3.5rem 1.25rem 4rem" }}>
      <article style={{ maxWidth: "680px", margin: "0 auto", color: S.mutedLight, lineHeight: 1.7, fontSize: "0.95rem" }}>

        <Link href="/" style={{ display: "inline-block", marginBottom: "2rem", fontSize: "0.8rem", color: S.muted, textDecoration: "none" }}>
          ← Back home
        </Link>

        <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
          Get in touch
        </p>
        <h1 className="font-display" style={{ margin: "0 0 1.5rem", fontSize: "2.25rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Contact
        </h1>

        <p style={{ margin: "0 0 1.5rem" }}>
          Got a question, found a bug, or need help with your subscription? We&apos;d love to hear from you. CaliPlan is run by a small team and we read every email.
        </p>

        <div style={{
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderLeft: `3px solid ${S.muscle}`,
          borderRadius: "10px",
          padding: "1.25rem 1.5rem",
          margin: "0 0 1.5rem",
        }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muscle }}>
            Support email
          </p>
          <a
            href="mailto:fillipdavidsen@gmail.com"
            style={{ fontSize: "1.05rem", color: S.white, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            fillipdavidsen@gmail.com
          </a>
        </div>

        <p style={{ margin: "0 0 2.5rem" }}>
          We typically reply within 1–2 business days.
        </p>

        <h2 style={{ margin: "0 0 1rem", fontSize: "1.15rem", fontWeight: 700, color: S.white, letterSpacing: "-0.01em" }}>
          Business details
        </h2>

        <div style={{
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: "10px",
          padding: "1.25rem 1.5rem",
        }}>
          <DetailRow label="App name" value="CaliPlan" />
          <DetailRow label="Operated by" value="Manly Prime" />
          <DetailRow label="Country" value="Denmark" />
          <DetailRow label="Support" value="fillipdavidsen@gmail.com" last />
        </div>

        <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: `1px solid ${S.border}`, display: "flex", gap: "1.5rem", fontSize: "0.8rem" }}>
          <Link href="/privacy" style={{ color: S.muted, textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: S.muted, textDecoration: "none" }}>Terms</Link>
          <Link href="/" style={{ color: S.muted, textDecoration: "none" }}>Home</Link>
        </div>
      </article>
    </main>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      gap: "1rem",
      padding: "0.75rem 0",
      borderBottom: last ? "none" : `1px solid ${S.border}`,
      alignItems: "baseline",
    }}>
      <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
        {label}
      </span>
      <span style={{ fontSize: "0.9rem", color: S.white }}>
        {value}
      </span>
    </div>
  );
}
