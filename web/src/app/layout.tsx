import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bandit — A/B tests that pick themselves.",
  description:
    "Bandit is the CRO daemon. Point it at any URL — it audits the page, generates page variants, runs the A/B tests, and ships the winner. No PMs. No tickets. No PostHog wiring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
