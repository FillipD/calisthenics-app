"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

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

const FEATURES = [
  "Adaptive weekly plan that evolves with you",
  "Full skill tree with progress tracking",
  "Skill goals woven into workouts",
  "Unlimited plan regenerations",
  "Cancel anytime",
];

interface Props {
  monthlyPriceId: string;
  yearlyPriceId:  string;
}

export default function PricingCards({ monthlyPriceId, yearlyPriceId }: Props) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  // Guard against double-firing the auto-checkout effect (React StrictMode
  // mounts effects twice in dev, and we don't want to hit the Stripe API
  // twice for the same intent).
  const autoCheckoutFired = useRef(false);

  useEffect(() => {
    track("pricing_viewed");
  }, []);

  const handleCheckout = useCallback(
    async (priceId: string, period: "monthly" | "yearly") => {
      if (!isSignedIn) {
        // Preserve intent across sign-up so the user lands back on /pricing
        // with ?checkout=<period> and is auto-forwarded to Stripe — no second
        // click required.
        router.push(
          `/sign-up?redirect_url=${encodeURIComponent(`/pricing?checkout=${period}`)}`,
        );
        return;
      }

      track("checkout_started", { period });

      setLoading(period);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else setLoading(null);
      } catch {
        setLoading(null);
      }
    },
    [isSignedIn, router],
  );

  // Auto-forward post-signup: if the URL carries ?checkout=monthly|yearly and
  // the user is now signed in, immediately kick off Stripe checkout for that
  // plan. This removes the "sign up → bounce back to /pricing → click again"
  // step that was dropping conversions.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (autoCheckoutFired.current) return;
    const checkout = searchParams.get("checkout");
    if (checkout !== "monthly" && checkout !== "yearly") return;
    autoCheckoutFired.current = true;
    const priceId = checkout === "yearly" ? yearlyPriceId : monthlyPriceId;
    handleCheckout(priceId, checkout);
  }, [isLoaded, isSignedIn, searchParams, yearlyPriceId, monthlyPriceId, handleCheckout]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: S.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "3rem 1.25rem 5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* ── Header + social proof counter ─────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
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
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: S.muscle,
                display: "inline-block",
              }}
            />
            Join 200+ calisthenics athletes training with CaliPlan
          </p>
          <h1
            className="font-display"
            style={{
              margin: "0 0 0.6rem",
              fontSize: "clamp(2rem, 7vw, 2.75rem)",
              fontWeight: 800,
              color: S.white,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Train smarter,
            <br />
            <span style={{ color: S.muscle }}>every week.</span>
          </h1>
          <p style={{ margin: 0, fontSize: "0.95rem", color: S.muted, lineHeight: 1.65 }}>
            CaliPlan Pro adapts your training as you progress — no guesswork, no plateaus.
          </p>
        </div>

        {/* ── Value props ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            marginBottom: "2rem",
          }}
        >
          {[
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
          ].map((item) => (
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

        {/* ── Testimonials ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            marginBottom: "2rem",
          }}
        >
          {[
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
          ].map((t, i) => (
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

        {/* ── Price cards ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>

          {/* Yearly — most popular */}
          <div
            style={{
              background: S.surface,
              border: `2px solid ${S.muscle}`,
              borderRadius: "16px",
              padding: "1.5rem",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
                background: S.muscle,
                color: S.bg,
                fontSize: "0.65rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.25rem 0.85rem",
                borderRadius: "100px",
                whiteSpace: "nowrap",
              }}
            >
              Most popular
            </span>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "0.75rem", fontWeight: 600, color: S.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Yearly
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>$4.99</span>
                  <span style={{ fontSize: "0.85rem", color: S.muted }}>/month</span>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: S.mutedLight }}>$59.88 billed annually</p>
              </div>
              <span
                style={{
                  background: "rgba(200,240,74,0.12)",
                  border: `1px solid rgba(200,240,74,0.35)`,
                  color: S.muscle,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.6rem",
                  borderRadius: "6px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Save 44%
              </span>
            </div>

            <FeatureList />

            <button
              onClick={() => handleCheckout(yearlyPriceId, "yearly")}
              disabled={loading !== null}
              style={{
                marginTop: "1.25rem",
                width: "100%",
                padding: "0.95rem",
                background: loading === "yearly" ? S.surfaceHigh : S.muscle,
                color: loading === "yearly" ? S.muted : S.bg,
                border: "none",
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: loading !== null ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                letterSpacing: "-0.01em",
                transition: "background 0.15s",
              }}
            >
              {loading === "yearly" ? "Redirecting…" : "Get CaliPlan Pro"}
            </button>
          </div>

          {/* Monthly */}
          <div
            style={{
              background: S.surface,
              border: `1.5px solid ${S.border}`,
              borderRadius: "16px",
              padding: "1.5rem",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ margin: "0 0 2px", fontSize: "0.75rem", fontWeight: 600, color: S.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Monthly
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
                <span style={{ fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>$8.99</span>
                <span style={{ fontSize: "0.85rem", color: S.muted }}>/month</span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: S.mutedLight }}>Cancel anytime</p>
            </div>

            <FeatureList />

            <button
              onClick={() => handleCheckout(monthlyPriceId, "monthly")}
              disabled={loading !== null}
              style={{
                marginTop: "1.25rem",
                width: "100%",
                padding: "0.95rem",
                background: "transparent",
                color: loading === "monthly" ? S.muted : S.white,
                border: `1.5px solid ${S.border}`,
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: loading !== null ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                letterSpacing: "-0.01em",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              {loading === "monthly" ? "Redirecting…" : "Get CaliPlan Pro"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: S.muted }}>
          Secure payment via Stripe. Cancel anytime from your account settings.
        </p>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: "2.5rem" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: S.white,
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your account settings and you keep access until the end of your billing period. No questions asked.",
              },
              {
                q: "What if I'm a complete beginner?",
                a: "CaliPlan is built for all levels. The skill tree starts from foundational exercises like dead hangs and push-up progressions — it meets you where you are.",
              },
              {
                q: "How does the plan adapt each week?",
                a: "When you log your workouts, CaliPlan sees what you completed and adjusts next week's plan — harder progressions where you're ready, more volume where you need it.",
              },
              {
                q: "What equipment do I need?",
                a: "You tell us what you have access to during onboarding. CaliPlan builds plans around your equipment — even bodyweight-only works.",
              },
              {
                q: "What's the difference between free and Pro?",
                a: "The free plan gives you a single 1-week snapshot. Pro gives you adaptive weekly plans, a full skill progression tree, workout logging, progress tracking, and personalised coaching that evolves with you.",
              },
            ].map((faq, i) => (
              <details
                key={i}
                style={{
                  background: S.surface,
                  border: `1px solid ${S.border}`,
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    padding: "0.9rem 1.1rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: S.white,
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    userSelect: "none",
                  }}
                >
                  {faq.q}
                  <span style={{ color: S.muted, fontSize: "0.75rem", flexShrink: 0, marginLeft: "0.5rem" }}>▾</span>
                </summary>
                <div
                  style={{
                    padding: "0 1.1rem 0.9rem",
                    fontSize: "0.82rem",
                    color: S.mutedLight,
                    lineHeight: 1.65,
                  }}
                >
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.72rem", color: S.muted }}>
          By subscribing you agree to our{" "}
          <a href="/terms" style={{ color: S.mutedLight, textDecoration: "underline" }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: S.mutedLight, textDecoration: "underline" }}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function FeatureList() {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {FEATURES.map(f => (
        <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.875rem", color: S.mutedLight }}>
          <span
            style={{
              flexShrink: 0,
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "rgba(200,240,74,0.12)",
              border: "1px solid rgba(200,240,74,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.55rem",
              color: S.muscle,
              fontWeight: 800,
            }}
          >
            ✓
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
