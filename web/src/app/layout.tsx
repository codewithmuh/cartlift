import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "./RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL("https://bandit.dev"),
  title: {
    default: "Bandit — Convert more visitors. Open-source.",
    template: "%s · Bandit",
  },
  description:
    "Bandit is the CRO daemon. Audits any URL for conversion, SEO, compliance and Google Merchant — then drafts page variants and runs the A/B tests. Open source.",
  applicationName: "Bandit",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bandit",
  },
  openGraph: {
    title: "Bandit — Convert more visitors. Open-source.",
    description:
      "Audits, page variants, and A/B tests — all in one daemon you can self-host.",
    type: "website",
    siteName: "Bandit",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@codewithmuh",
    title: "Bandit — Convert more visitors. Open-source.",
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
        <link rel="mask-icon" href="/icon-512.svg" color="#15803d" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
