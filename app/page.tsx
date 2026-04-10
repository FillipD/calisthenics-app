import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrLinkProfile } from "@/lib/getOrLinkProfile";

const S = {
  bg: "#0f0f0e",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  muscle: "#c8f04a",
  border: "#2e2e2b",
};

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
    <main
      style={{
        minHeight: "100dvh",
        background: S.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1.25rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          margin: "0 0 0.5rem",
          fontSize: "2.5rem",
          fontWeight: 800,
          color: S.white,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        CaliPlan
      </h1>

      <p
        style={{
          margin: "0 0 2.5rem",
          fontSize: "1rem",
          color: S.muted,
        }}
      >
        Your adaptive calisthenics training app
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "260px" }}>
        <Link
          href="/start"
          style={{
            background: S.muscle,
            color: "#0f0f0e",
            padding: "0.85rem 1.5rem",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.95rem",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Get started free
        </Link>

        <Link
          href="/sign-in"
          style={{
            background: "none",
            color: S.white,
            padding: "0.85rem 1.5rem",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.95rem",
            textDecoration: "none",
            border: `1px solid ${S.border}`,
            letterSpacing: "-0.01em",
          }}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
