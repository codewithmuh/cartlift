"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError, auth, publicAudits, readTokens, writeTokens } from "@/lib/api";

function normalize(raw: string): string {
  let url = raw.trim();
  if (url.startsWith("http://")) url = url.slice(7);
  if (url.startsWith("https://")) url = url.slice(8);
  return url.replace(/\/$/, "");
}

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditHint = searchParams.get("audit") || "";
  const claimSlug = searchParams.get("claim") || "";
  const display = auditHint ? normalize(auditHint) : "";

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Send them straight where they were going.
  useEffect(() => {
    if (!readTokens()) return;
    if (auditHint) {
      router.replace(`/dashboard/audits?run=${encodeURIComponent(auditHint)}`);
    } else {
      router.replace("/dashboard");
    }
  }, [router, auditHint]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { access, refresh } = await auth.signup(email, password, company);
      writeTokens({ access, refresh });

      // If they came from a /audit/<slug> public preview, claim it instead of
      // re-running — saves the Claude call and preserves their share-link findings.
      if (claimSlug) {
        try {
          const claimed = await publicAudits.claim(claimSlug);
          // Land on the cro audit (the marketing-canonical lens). If for some
          // reason it's missing, just send them to the audits list.
          const croId = claimed.audits.cro?.id;
          router.push(croId ? `/dashboard/audits/${croId}` : "/dashboard/audits");
          return;
        } catch {
          // fall through to the normal path on claim failure
        }
      }

      const next = auditHint
        ? `/dashboard/audits?run=${encodeURIComponent(auditHint)}`
        : "/dashboard";
      router.push(next);
    } catch (e) {
      let detail = "Could not create your workspace.";
      if (e instanceof ApiError && e.data && typeof e.data === "object") {
        const d = e.data as Record<string, unknown>;
        if (typeof d.detail === "string") detail = d.detail;
        else if (Array.isArray(d.email)) detail = `email: ${d.email[0]}`;
        else if (Array.isArray(d.password)) detail = `password: ${d.password[0]}`;
      }
      setErr(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <Link href="/" className="auth-brand">
        <span className="brand-mark">B</span>
        bandit
      </Link>

      {auditHint ? (
        <>
          <h1>your audit's <em>queued.</em></h1>
          <p className="subhead">
            create an account in 30 seconds and we'll deliver the full report — every
            finding, every variant, downloadable.
          </p>

          <div className="audit-ticket">
            <span className="heading">audit ticket · ready to run</span>
            <span className="url">{display}</span>
            <span className="meta">
              <span>cro · seo · compliance</span>
              <span className="dot">·</span>
              <span>~30s after signup</span>
              <span className="dot">·</span>
              <span style={{ color: "var(--lime)" }}>free</span>
            </span>
          </div>
        </>
      ) : (
        <>
          <h1>start with <em>bandit.</em></h1>
          <p className="subhead">
            no card. first three audits + first experiment on us. takes 30 seconds.
          </p>
        </>
      )}

      {err && <div className="form-error">{err}</div>}

      <div className="field">
        <label>work email</label>
        <input type="email" required autoComplete="email"
          placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field">
        <label>company (optional)</label>
        <input type="text" autoComplete="organization"
          placeholder="your company"
          value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>

      <div className="field">
        <label>password</label>
        <input type="password" required minLength={8} autoComplete="new-password"
          placeholder="at least 8 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <button type="submit" className="btn btn-lime" disabled={busy} style={{ width: "100%", justifyContent: "center", padding: "14px" }}>
        {busy
          ? (auditHint ? "claiming…" : "creating…")
          : (auditHint ? "claim my audit →" : "create account →")}
      </button>

      <div className="free-row">
        <span className="free-badge">no card</span>
        <span className="free-badge">no install</span>
        <span className="free-badge">audit in 30s</span>
        <span className="free-badge">first experiment free</span>
      </div>

      <p className="form-link">
        already have an account? <Link href="/signin">sign in</Link>
      </p>
    </form>
  );
}

export default function SignupForm() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}
