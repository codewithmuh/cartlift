import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms governing use of Cartlift's hosted plan. The open-source code itself is governed by the MIT license.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
        Terms of service
      </h1>
      <p className="mono fine" style={{ marginBottom: 32 }}>
        Last updated: 2026-05-10 · For the hosted plan only. Open-source code is governed by the MIT license.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        1. The agreement
      </h2>
      <p>
        By creating an account on Cartlift&rsquo;s hosted plan, you agree to these terms. If you
        don&rsquo;t agree, don&rsquo;t use the hosted plan — clone the open-source repo and self-host instead.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        2. Accounts
      </h2>
      <p>
        You are responsible for keeping your password and JWT tokens secure. If your account is
        compromised, email <a href="mailto:contact@codewithmuh.com" style={{ color: "var(--lime)" }}>contact@codewithmuh.com</a> immediately and we&rsquo;ll rotate
        your tokens.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        3. Acceptable use
      </h2>
      <p>You may not use Cartlift to:</p>
      <ul style={{ paddingLeft: 22, marginBottom: 18 }}>
        <li>Audit or run experiments on sites you don&rsquo;t own or have written permission to test.</li>
        <li>Crawl URLs at a rate that would be considered denial of service.</li>
        <li>Inject deceptive variants — copy that misleads buyers about price, availability, or refund policy.</li>
        <li>Run experiments that violate the terms of the platforms hosting your site (Shopify, Webflow, etc).</li>
        <li>Resell the hosted plan as a white-label service without prior written agreement (the MIT-licensed self-hosted version is fine to white-label).</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        4. The audit pipeline
      </h2>
      <p>
        Audits use machine learning models (Anthropic Claude) to draft findings and variants.
        These outputs are best-effort recommendations, not professional advice. You are
        responsible for reviewing variants before approving them and for monitoring experiment
        results.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        5. Cancellation + data retention
      </h2>
      <p>
        Cancel anytime from your dashboard. After cancellation we keep your data for 30 days in
        case you want to reactivate, then we delete it. Email us if you want it deleted sooner.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        6. Liability
      </h2>
      <p>
        Cartlift is provided &ldquo;as is&rdquo;. We don&rsquo;t guarantee a specific lift, uptime, or audit
        accuracy. Our maximum liability for any claim is the amount you paid us in the 12
        months prior to the claim. The MIT license disclaimers apply to the self-hosted version.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        7. Changes
      </h2>
      <p>
        We&rsquo;ll update the &ldquo;last updated&rdquo; date when these change. Material changes get a
        heads-up email at least 14 days in advance.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        8. Governing law
      </h2>
      <p>
        These terms are governed by the laws of the jurisdiction where Cartlift Labs is registered.
      </p>

      <p style={{ marginTop: 32, paddingTop: 18, borderTop: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 15 }}>
        Questions? <a href="mailto:contact@codewithmuh.com" style={{ color: "var(--lime)" }}>contact@codewithmuh.com</a>
      </p>
    </>
  );
}
