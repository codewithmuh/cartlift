import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Cartlift handles personal data, audit URLs, and the JS snippet's visitor identifiers. Open-source so you can verify every word.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
        Privacy
      </h1>
      <p className="mono fine" style={{ marginBottom: 32 }}>
        Last updated: 2026-05-10 · Plain English. No dark patterns.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        TL;DR
      </h2>
      <ul style={{ paddingLeft: 22, marginBottom: 18 }}>
        <li>We store your email, password (hashed), and company name.</li>
        <li>Audit URLs you submit are stored in our database under your account.</li>
        <li>The JS snippet on customer sites uses a random visitor ID stored in localStorage. No cookies. No fingerprinting.</li>
        <li>We never sell or share your data with third parties.</li>
        <li>You can self-host the entire stack and we&rsquo;ll see none of your data.</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        Data we collect
      </h2>
      <p>
        On the hosted plan, when you sign up we store: your email address (used to identify
        your account and send transactional emails), a salted hash of your password (we never
        see the plaintext after submission), and an optional company name.
      </p>
      <p>
        When you run an audit, we store: the URL you submitted, the resulting findings, and
        the time the audit ran. We do not store full page HTML beyond the audit run.
      </p>
      <p>
        The JS snippet (when installed on your sites) stores in each visitor&rsquo;s
        <code style={{ background: "var(--bg-1)", padding: "2px 6px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 15 }}> localStorage</code>:
        a random visitor ID like <code style={{ background: "var(--bg-1)", padding: "2px 6px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 15 }}>v_abc123…</code> and the variant
        each visitor was assigned per experiment. We do not set cookies and do not
        fingerprint. The visitor ID is meaningless outside your workspace.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        Where data lives
      </h2>
      <p>
        Hosted-plan data lives in a Postgres database in the region you signed up in. The
        Anthropic API (used for AI-drafted findings + variants) processes the visible text of
        URLs you submit. Anthropic does not retain that data for training under their API terms.
      </p>
      <p>
        On <strong>self-hosted</strong> deployments, none of this applies — your data lives in
        your own Postgres, your own Claude API key, your own infrastructure. We never see it.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        Your rights (GDPR / CCPA)
      </h2>
      <ul style={{ paddingLeft: 22, marginBottom: 18 }}>
        <li>Access: email <a href="mailto:contact@codewithmuh.com" style={{ color: "var(--lime)" }}>contact@codewithmuh.com</a> for a copy of your data.</li>
        <li>Deletion: same address. We delete within 30 days.</li>
        <li>Portability: every audit is downloadable as JSON or Markdown from the dashboard.</li>
        <li>Objection / restriction: same address.</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        Cookies
      </h2>
      <p>
        We do not use third-party tracking cookies. We use one first-party
        <code style={{ background: "var(--bg-1)", padding: "2px 6px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 15 }}> localStorage</code> entry on the dashboard to store your JWT.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 12 }}>
        Changes
      </h2>
      <p>
        We&rsquo;ll update the &ldquo;last updated&rdquo; date at the top whenever this changes. Material changes
        get a heads-up email to active accounts.
      </p>

      <p style={{ marginTop: 32, paddingTop: 18, borderTop: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 15 }}>
        Questions? <a href="mailto:contact@codewithmuh.com" style={{ color: "var(--lime)" }}>contact@codewithmuh.com</a>
      </p>
    </>
  );
}
