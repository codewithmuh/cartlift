// Public audit preview — shareable, SEO-indexable.
// First 2 findings render in full; remainder blurred behind a signup CTA.

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

type Finding = {
  surface: string;
  severity: "high" | "medium" | "low";
  label: string;
  note: string;
  predicted_lift_pct: number;
};

type PublicAudit = {
  slug: string;
  url: string;
  audit_type: string;
  status: string;
  page_title: string;
  summary: string;
  findings: Finding[];
  elapsed_ms: number;
  created_at: string;
};

const PUBLIC_FREE_FINDINGS = 2;

function apiBase(): string {
  // Server-side: prefer NEXT_PUBLIC_API_BASE if set, else internal docker host, else localhost.
  return (
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.API_BASE_INTERNAL ||
    "http://localhost:8050"
  );
}

async function fetchAudit(slug: string): Promise<PublicAudit | null> {
  try {
    const r = await fetch(`${apiBase()}/api/public/audits/${slug}/`, {
      // Short revalidate — audit content is immutable but we want fast invalidation if claimed.
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    return (await r.json()) as PublicAudit;
  } catch {
    return null;
  }
}

function normalizeHost(u: string): string {
  try {
    const url = new URL(u);
    return url.host + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return u;
  }
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await fetchAudit(slug);
  if (!a) {
    return { title: "Audit not found — Bandit", robots: { index: false } };
  }
  const host = normalizeHost(a.url);
  const findings = a.findings?.length ?? 0;
  const title = `${host} — CRO audit · ${findings} findings · Bandit`;
  const description = a.summary
    ? a.summary.slice(0, 158)
    : `Free CRO audit for ${host}. ${findings} annotated findings on hero copy, CTAs, social proof, and checkout friction — generated in ${(a.elapsed_ms / 1000).toFixed(1)}s.`;
  return {
    title,
    description,
    alternates: { canonical: `/audit/${slug}` },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicAuditPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await fetchAudit(slug);
  if (!a) notFound();

  // Make sure we don't crash on partial data from a failed run.
  const findings = Array.isArray(a.findings) ? a.findings : [];
  const visible = findings.slice(0, PUBLIC_FREE_FINDINGS);
  const locked = Math.max(0, findings.length - visible.length);
  const host = normalizeHost(a.url);
  const totalLift = findings.reduce((s, f) => s + (f.predicted_lift_pct || 0), 0);

  // Forward the slug to signup so we can claim it after auth.
  const claimHref = `/signup?audit=${encodeURIComponent(a.url)}&claim=${a.slug}`;

  // Touch headers() so this stays dynamic per request — the share recipient
  // gets a fresh metadata fetch rather than a cached marketing-page response.
  await headers();

  return (
    <main className="audit-public">
      <nav className="audit-pub-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">B</span>
          bandit
        </Link>
        <Link href={claimHref} className="btn btn-lime">audit your site →</Link>
      </nav>

      <div className="shell-tight">
        <div className="eyebrow">free public audit</div>
        <h1 className="audit-pub-h1">
          <span className="audit-pub-host">{host}</span>
          <span className="audit-pub-h1-sub">/ {findings.length} findings · CRO</span>
        </h1>

        <div className="audit-pub-meta">
          <span><strong>{(a.elapsed_ms / 1000).toFixed(1)}s</strong> · audited by claude</span>
          <span className="dot">·</span>
          <span>predicted uplift if all shipped: <strong style={{ color: "var(--lime)" }}>+{totalLift.toFixed(1)}%</strong></span>
          <span className="dot">·</span>
          <span>{new Date(a.created_at).toLocaleDateString()}</span>
        </div>

        {a.page_title && (
          <p className="audit-pub-title">page title: <em>{a.page_title}</em></p>
        )}
        {a.summary && (
          <p className="audit-pub-summary">{a.summary}</p>
        )}

        {findings.length === 0 ? (
          <div className="audit-pub-empty">
            <strong>no findings.</strong> the audit ran but came back clean — or the page blocked our fetcher. paste another url to try again.
            <div style={{ marginTop: 16 }}>
              <Link href="/" className="btn btn-lime">try another url →</Link>
            </div>
          </div>
        ) : (
          <ol className="audit-pub-findings">
            {visible.map((f, i) => (
              <li key={i} className="audit-pub-finding">
                <div className="audit-pub-finding-head">
                  <span className={`sev sev-${f.severity}`}>● {f.severity}</span>
                  <span className="surface">{f.surface}</span>
                  {f.predicted_lift_pct > 0 && (
                    <span className="lift">+{f.predicted_lift_pct}%</span>
                  )}
                </div>
                <h3>{f.label}</h3>
                <p>{f.note}</p>
              </li>
            ))}

            {locked > 0 && (
              <li className="audit-pub-locked">
                <div className="audit-pub-locked-blur" aria-hidden>
                  {Array.from({ length: Math.min(locked, 3) }).map((_, i) => (
                    <div key={i} className="audit-pub-blur-card">
                      <div className="head">
                        <span className="sev sev-medium">● ████</span>
                        <span className="surface">██████ · ████</span>
                        <span className="lift">+█.█%</span>
                      </div>
                      <h3>███████ ████████ ██████ ████ ████ ████ ███</h3>
                      <p>███████ ████ █████ ███████ ██████ ████ ███████ ████ ██████ ███ ███████ █████ ████ ███████ ████ ████ ███████.</p>
                    </div>
                  ))}
                </div>
                <div className="audit-pub-locked-overlay">
                  <div className="audit-pub-locked-card">
                    <div className="eyebrow">{locked} more findings</div>
                    <h2>The rest of the audit is one click away.</h2>
                    <p>
                      Sign up free to unlock {locked} more {locked === 1 ? "finding" : "findings"},
                      generate page variants, and run A/B tests with the multi-armed bandit.
                      No card. ~30 seconds.
                    </p>
                    <div className="audit-pub-locked-actions">
                      <Link href={claimHref} className="btn btn-lime">unlock the audit →</Link>
                      <a href="https://github.com/codewithmuh/bandit" className="btn btn-ghost">or self-host ↗</a>
                    </div>
                  </div>
                </div>
              </li>
            )}
          </ol>
        )}

        <section className="audit-pub-footer">
          <div className="audit-pub-share">
            <span className="mono">share this audit</span>
            <code className="mono">bandit.dev/audit/{a.slug}</code>
          </div>
          <p className="lede" style={{ marginTop: 24 }}>
            Bandit is the open-source CRO platform. Audits any URL, drafts page
            variants, ships them via a JS snippet, and runs Thompson-sampled A/B
            tests. MIT licensed. <Link href="/" style={{ color: "var(--lime)" }}>see how it works →</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
