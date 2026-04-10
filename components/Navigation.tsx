"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, UserButton } from "@clerk/nextjs";
import { LayoutDashboard, GitBranch, TrendingUp, Settings } from "lucide-react";

const S = {
  bg: "#0f0f0e",
  border: "#2e2e2b",
  white: "#f5f0e8",
  muted: "#7a7a6e",
  muscle: "#c8f04a",
};

const HIDDEN_PATHS = ["/", "/start", "/sign-in", "/sign-up"];

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/skills",    label: "Skills",    icon: GitBranch },
  { href: "/progress",  label: "Progress",  icon: TrendingUp },
  { href: "/settings",  label: "Settings",  icon: Settings  },
];

export default function Navigation() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  if (!isSignedIn || HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav
        className="hidden md:flex"
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 50,
          height: "56px",
          background: S.bg,
          borderBottom: `1px solid ${S.border}`,
          alignItems: "center",
          padding: "0 1.75rem",
          gap: "1.75rem",
        }}
      >
        <Link href="/dashboard" style={{ textDecoration: "none", marginRight: "auto" }}>
          <span style={{ fontSize: "1rem", fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            Cali<span style={{ color: S.muscle }}>Plan</span>
          </span>
        </Link>

        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: active ? 600 : 400,
                color: active ? S.white : S.muted,
                transition: "color 0.15s",
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          );
        })}

        <UserButton />
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 50,
          background: S.bg,
          borderTop: `1px solid ${S.border}`,
          alignItems: "center",
          justifyContent: "space-around",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.2rem",
                textDecoration: "none",
                color: active ? S.muscle : S.muted,
                flex: 1,
                padding: "0.6rem 0",
                transition: "color 0.15s",
              }}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 1.75} />
              <span style={{ fontSize: "0.6rem", fontWeight: active ? 700 : 400, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {label}
              </span>
            </Link>
          );
        })}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.2rem",
            flex: 1,
            padding: "0.6rem 0",
          }}
        >
          <UserButton />
          <span style={{ fontSize: "0.6rem", color: S.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Account
          </span>
        </div>
      </nav>
    </>
  );
}
