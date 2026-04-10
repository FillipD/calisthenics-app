"use client";

import { useState } from "react";
import type { Goal } from "@/types";

const GOALS: { value: Goal; label: string }[] = [
  { value: "build-strength",        label: "Build strength" },
  { value: "build-muscle",          label: "Build muscle"  },
  { value: "build-strength-muscle", label: "Both"          },
];

const EQUIPMENT_OPTIONS = [
  "Pull-up bar",
  "Parallel bars / dip bars",
  "Rings",
  "Parallettes",
  "Resistance bands",
  "Nordic curl anchor",
  "Weights (belt or vest)",
  "Vertical pole",
  "Bodyweight only",
];

const S = {
  bg: "#0f0f0e",
  surface: "#1a1a18",
  surfaceHigh: "#222220",
  border: "#2e2e2b",
  borderHover: "#3e3e3a",
  muscle: "#c8f04a",
  rust: "#e05a2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  mutedLight: "#a0a090",
};

interface Props {
  initialDaysPerWeek: number;
  initialGoal: Goal;
  initialEquipment: string[];
}

export default function SettingsForm({ initialDaysPerWeek, initialGoal, initialEquipment }: Props) {
  const [daysPerWeek, setDaysPerWeek] = useState(initialDaysPerWeek);
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [equipment, setEquipment] = useState<string[]>(initialEquipment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // browser is leaving — don't reset loading
      }
      setPortalError(data.error ?? "Could not open subscription portal.");
    } catch {
      setPortalError("Could not open subscription portal. Please try again.");
    }
    setPortalLoading(false);
  }

  function toggleEquipment(item: string) {
    if (item === "Bodyweight only") {
      setEquipment(["Bodyweight only"]);
    } else {
      setEquipment(prev => {
        const without = prev.filter(e => e !== "Bodyweight only" && e !== item);
        return prev.includes(item) ? without : [...without, item];
      });
    }
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days_per_week: daysPerWeek, goal, equipment }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: "540px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
            Preferences
          </p>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            Settings
          </h1>
        </div>

        {/* ── Section: Training days ── */}
        <section style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
            Training days per week
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[1, 2, 3, 4, 5, 6].map(n => {
              const active = daysPerWeek === n;
              return (
                <button
                  key={n}
                  onClick={() => { setDaysPerWeek(n); setSaved(false); }}
                  style={{
                    flex: 1,
                    padding: "0.65rem 0",
                    background: active ? S.muscle : S.surface,
                    border: `1px solid ${active ? S.muscle : S.border}`,
                    borderRadius: "8px",
                    color: active ? "#0f0f0e" : S.mutedLight,
                    fontSize: "0.95rem",
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Goal ── */}
        <section style={{ marginBottom: "2rem" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
            Goal
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {GOALS.map(({ value, label }) => {
              const active = goal === value;
              return (
                <button
                  key={value}
                  onClick={() => { setGoal(value); setSaved(false); }}
                  style={{
                    width: "100%",
                    padding: "0.8rem 1.1rem",
                    background: active ? S.surface : S.surface,
                    border: `1px solid ${active ? S.muscle : S.border}`,
                    borderRadius: "8px",
                    color: active ? S.white : S.mutedLight,
                    fontSize: "0.9rem",
                    fontWeight: active ? 600 : 400,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {label}
                  {active && (
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: S.muscle, display: "inline-block" }} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Equipment ── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: S.muted }}>
            Equipment
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {EQUIPMENT_OPTIONS.map(item => {
              const active = equipment.includes(item);
              const isBodyweight = item === "Bodyweight only";
              return (
                <button
                  key={item}
                  onClick={() => toggleEquipment(item)}
                  style={{
                    gridColumn: isBodyweight ? "span 2" : undefined,
                    padding: "0.7rem 1rem",
                    background: active ? S.surface : S.surface,
                    border: `1px solid ${active ? S.muscle : S.border}`,
                    borderRadius: "8px",
                    color: active ? S.white : S.mutedLight,
                    fontSize: "0.85rem",
                    fontWeight: active ? 600 : 400,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <p style={{ color: S.rust, fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</p>
        )}

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            background: saving ? S.border : S.muscle,
            color: saving ? S.muted : "#0f0f0e",
            border: "none",
            borderRadius: "8px",
            padding: "0.9rem",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            transition: "background 0.15s",
            marginBottom: "1rem",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {saved && (
          <p style={{ margin: 0, fontSize: "0.85rem", color: S.mutedLight, textAlign: "center" }}>
            Changes saved.
          </p>
        )}

        {/* ── Section: Subscription ── */}
        <section style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: `1px solid ${S.border}` }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
            Billing
          </p>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: 700, color: S.white, letterSpacing: "-0.02em" }}>
            Subscription
          </h2>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: S.mutedLight, lineHeight: 1.6 }}>
            Update your payment method, view invoices, or cancel your subscription. Cancellations take effect at the end of your current billing period — you keep pro access until then.
          </p>

          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            style={{
              width: "100%",
              background: "transparent",
              color: portalLoading ? S.muted : S.white,
              border: `1px solid ${S.border}`,
              borderRadius: "8px",
              padding: "0.85rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: portalLoading ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              transition: "border-color 0.15s, color 0.15s",
            }}
          >
            {portalLoading ? "Opening portal…" : "Manage subscription"}
          </button>

          {portalError && (
            <p style={{ color: S.rust, fontSize: "0.85rem", marginTop: "0.75rem" }}>{portalError}</p>
          )}
        </section>

      </div>
    </main>
  );
}
