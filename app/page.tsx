import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";

const S = {
  bg:          "#0f0f0e",
  surface:     "#1a1a18",
  surfaceHigh: "#222220",
  border:      "#2e2e2b",
  white:       "#f5f0e8",
  muted:       "#7a7a6e",
  mutedLight:  "#a0a090",
  muscle:      "#c8f04a",
  rust:        "#e05a2b",
};

const VALUE_PROPS = [
  {
    icon: "🎯",
    title: "Skill-targeted plans",
    desc: "Pick goals like the muscle-up, handstand, or front lever. Your weekly plan is built around the exact progressions that get you there.",
  },
  {
    icon: "📈",
    title: "Adapts every week",
    desc: "Log what you did and CaliPlan adjusts next week — harder where you're ready, more volume where you need it.",
  },
  {
    icon: "🏋️",
    title: "100+ progressions",
    desc: "A full skill tree across Pull, Push, Legs & Core. Every exercise has a clear next step so you always know what to work on.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Test your level",
    desc: "Two minutes, three movements. We score your pull, push, and dip strength to find where you really are.",
  },
  {
    n: "02",
    title: "Get your plan",
    desc: "A personalised 7-day plan built around your level, your goals, and the equipment you have. Free to start.",
  },
  {
    n: "03",
    title: "Progress every week",
    desc: "Log your workouts and your plan evolves. No more repeating the same routine while your body stops adapting.",
  },
];

const TESTIMONIALS = [
  {
    quote: "I went from 3 pull-ups to training for the muscle-up in 8 weeks. The skill tree makes it so clear what to work on next.",
    name: "Marcus T.",
    detail: "Intermediate",
  },
  {
    quote: "Finally a calisthenics app that actually progresses you instead of giving you the same workout every week.",
    name: "Sophie K.",
    detail: "Beginner+",
  },
  {
    quote: "The adaptive plans are a game changer. It feels like having a coach who actually tracks what I do.",
    name: "Daniel R.",
    detail: "Advanced",
  },
];

export default async function Home() {
  const user = await currentUser();

  if (user) {
    const profile = await getOrLinkProfile(user);

    if (!profile) {
      redirect("/start");
    } else if (profile.subscription_status === "pro") {
      redirect("/dashboard");
    } else {
      redirect("/pricing");
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: S.bg, display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1.25rem 4rem" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: S.muscle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: S.muscle, display: "inline-block" }} />
              Join 200+ calisthenics athletes training with CaliPlan
            </p>
            <h1
              className="font-display"
              style={{
                margin: "0 0 0.85rem",
                fontSize: "clamp(2.25rem, 8vw, 3.25rem)",
                fontWeight: 800,
                color: S.white,
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
              }}
            >
              Calisthenics,
              <br />
              <span style={{ color: S.muscle }}>built for you.</span>
            </h1>
            <p style={{ margin: "0 0 1.75rem", fontSize: "1rem", color: S.mutedLight, lineHeight: 1.6 }}>
              A personalised plan that adapts every week. Progress toward real skills — muscle-up, handstand, front lever — with a full progression tree.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%", maxWidth: "300px", margin: "0 auto" }}>
              <Link
                href="/start"
                style={{
                  background: S.muscle,
                  color: S.bg,
                  padding: "0.95rem 1.5rem",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                }}
              >
                Get started free
              </Link>
              <Link
                href="/pricing"
                style={{
                  background: "transparent",
                  color: S.white,
                  padding: "0.95rem 1.5rem",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  border: `1.5px solid ${S.border}`,
                  letterSpacing: "-0.01em",
                }}
              >
                See Pro pricing
              </Link>
            </div>
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.72rem", color: S.muted }}>
              No credit card required · 2-minute assessment
            </p>
          </div>

          {/* ── How it works ─────────────────────────────────────────────── */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              className="font-display"
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: S.muscle,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                textAlign: "center",
                margin: "0 0 1.1rem",
              }}
            >
              How it works
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  style={{
                    background: S.surface,
                    border: `1px solid ${S.border}`,
                    borderRadius: "12px",
                    padding: "1.1rem 1.15rem",
                    display: "flex",
                    gap: "0.95rem",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      flexShrink: 0,
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      color: S.muscle,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                      minWidth: "2ch",
                    }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", fontWeight: 600, color: S.white }}>
                      {s.title}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: S.muted, lineHeight: 1.6 }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Value props ──────────────────────────────────────────────── */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              className="font-display"
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: S.white,
                letterSpacing: "-0.02em",
                textAlign: "center",
                margin: "0 0 1.1rem",
                lineHeight: 1.15,
              }}
            >
              Why CaliPlan
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {VALUE_PROPS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    background: S.surface,
                    border: `1px solid ${S.border}`,
                    borderRadius: "12px",
                    padding: "1.1rem 1.15rem",
                    display: "flex",
                    gap: "0.85rem",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "1.3rem", flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.88rem", fontWeight: 600, color: S.white }}>
                      {item.title}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: S.muted, lineHeight: 1.55 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Testimonials ─────────────────────────────────────────────── */}
          <section style={{ marginBottom: "2.5rem" }}>
            <h2
              className="font-display"
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: S.white,
                letterSpacing: "-0.02em",
                textAlign: "center",
                margin: "0 0 1.1rem",
                lineHeight: 1.15,
              }}
            >
              What athletes say
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: S.surface,
                    border: `1px solid ${S.border}`,
                    borderRadius: "12px",
                    padding: "1rem 1.15rem",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 0.5rem",
                      fontSize: "0.85rem",
                      color: S.mutedLight,
                      lineHeight: 1.6,
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: S.white }}>{t.name}</span>
                    <span style={{ fontSize: "0.68rem", color: S.muted }}>·</span>
                    <span style={{ fontSize: "0.68rem", color: S.muscle, fontWeight: 500 }}>{t.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Final CTA ────────────────────────────────────────────────── */}
          <section
            style={{
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: "16px",
              padding: "1.75rem 1.25rem",
              textAlign: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              className="font-display"
              style={{
                margin: "0 0 0.6rem",
                fontSize: "1.5rem",
                fontWeight: 800,
                color: S.white,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              Ready to train smarter?
            </h2>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.88rem", color: S.muted, lineHeight: 1.6 }}>
              Get your free 7-day plan in 2 minutes. Upgrade to Pro any time for adaptive weekly training and the full skill tree.
            </p>
            <Link
              href="/start"
              style={{
                display: "inline-block",
                background: S.muscle,
                color: S.bg,
                padding: "0.9rem 1.75rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Get started free
            </Link>
          </section>

          <p style={{ textAlign: "center", margin: "0.5rem 0 0", fontSize: "0.8rem", color: S.muted }}>
            Already have an account?{" "}
            <Link href="/sign-in" style={{ color: S.mutedLight, textDecoration: "underline" }}>
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <footer
        style={{
          padding: "1.5rem 1.25rem 2rem",
          textAlign: "center",
          borderTop: `1px solid ${S.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            justifyContent: "center",
            flexWrap: "wrap",
            fontSize: "0.78rem",
            color: S.muted,
          }}
        >
          <Link href="/privacy" style={{ color: S.muted, textDecoration: "none" }}>
            Privacy
          </Link>
          <Link href="/terms" style={{ color: S.muted, textDecoration: "none" }}>
            Terms
          </Link>
          <Link href="/contact" style={{ color: S.muted, textDecoration: "none" }}>
            Contact
          </Link>
        </div>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.7rem", color: S.muted }}>
          © {new Date().getFullYear()} Manly Prime
        </p>
      </footer>
    </div>
  );
}
