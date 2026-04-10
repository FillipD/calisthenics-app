"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  "AI-generated adaptive weekly plan",
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
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);

  async function handleCheckout(priceId: string, period: "monthly" | "yearly") {
    if (!isSignedIn) {
      router.push("/sign-up?redirect_url=/pricing");
      return;
    }

    setLoading(period);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: S.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4rem 1.25rem 5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1
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

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

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
                  <span style={{ fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>$59.99</span>
                  <span style={{ fontSize: "0.85rem", color: S.muted }}>/year</span>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: S.mutedLight }}>$5/month · billed annually</p>
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

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: S.muted }}>
          Secure payment via Stripe. Cancel anytime from your account settings.
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
