import { currentUser } from "@clerk/nextjs/server";

const S = {
  bg: "#0f0f0e",
  surface: "#1a1a18",
  border: "#2e2e2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  muscle: "#c8f04a",
};

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  return (
    <main style={{ minHeight: "100dvh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem", textAlign: "center" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>
        Welcome back
      </p>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "2rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
        {firstName}
      </h1>
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: "10px", padding: "1.5rem 2rem", maxWidth: "400px", width: "100%" }}>
        <p style={{ margin: 0, fontSize: "0.95rem", color: S.muted, lineHeight: 1.6 }}>
          Your dashboard is coming soon.
        </p>
      </div>
    </main>
  );
}
