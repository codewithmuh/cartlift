import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import JsonLd from "./JsonLd";
import RegisterSW from "./RegisterSW";

// Dogfood: load Bandit's own snippet on the marketing site so the page
// running the experiments is the one we're advertising. Gated on both env
// vars so local dev / forks without a public site just no-op.
const BANDIT_API = process.env.NEXT_PUBLIC_BANDIT_API_BASE || "";
const BANDIT_TOKEN = process.env.NEXT_PUBLIC_BANDIT_TOKEN || "";

export const metadata: Metadata = {
  metadataBase: new URL("https://bandit.dev"),
  title: {
    default: "Cartlift — Lift every cart. Open-source ecommerce CRO.",
    template: "%s · Cartlift",
  },
  description:
    "Cartlift is the open-source CRO platform for ecommerce. Audits your store pages, drafts conversion variants, and runs the A/B tests. More buyers. Higher AOV. Repeat customers. Open source.",
  applicationName: "Cartlift",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cartlift",
  },
  openGraph: {
    title: "Cartlift — Lift every cart. Open-source ecommerce CRO.",
    description:
      "Store audits, page variants, and A/B tests — all in one tool you can self-host.",
    type: "website",
    siteName: "Cartlift",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@codewithmuh",
    title: "Cartlift — Lift every cart. Open-source ecommerce CRO.",
  },
  authors: [{ name: "codewithmuh", url: "https://www.youtube.com/@codewithmuh" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA install criteria — Next.js doesn't auto-emit these for SVG apple icons */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-512.svg" />
        <link rel="mask-icon" href="/icon-512.svg" color="#c2410c" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <JsonLd />
      </head>
      <body>
        <a href="#main" className="skip-link">skip to content</a>
        <div id="main">{children}</div>
        <RegisterSW />
        {BANDIT_API && BANDIT_TOKEN ? (
          <Script
            src={`${BANDIT_API.replace(/\/$/, "")}/s/${BANDIT_TOKEN}.js`}
            strategy="afterInteractive"
            data-bandit-source="self-dogfood"
          />
        ) : null}
      </body>
    </html>
  );
}
