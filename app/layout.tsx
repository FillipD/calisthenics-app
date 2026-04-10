import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Navigation from "@/components/Navigation";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaliPlan — Your adaptive calisthenics training app",
  description: "Answer 3 quick questions and get a free personalised calisthenics plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <PostHogProvider />
          <Navigation />
          {/* md:pt-14 clears the fixed desktop top nav (56px); pb-20 clears the fixed mobile bottom nav */}
          <div className="md:pt-14 pb-20 md:pb-0">
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
