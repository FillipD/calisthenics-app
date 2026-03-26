// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calisthenics Starter — Find Your Level",
  description:
    "Answer 3 quick questions and get a free personalised beginner calisthenics plan. Built for absolute beginners.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
