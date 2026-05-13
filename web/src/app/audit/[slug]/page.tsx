// Public audit bundle — shareable, SEO-indexable, free to view.
// One submission = four reports (cro / seo / trust / gmc) on a single URL.
// Tabs let visitors switch between them without login.
// PDF download is gated by an email capture; everything else is free.

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import BundleView from "./BundleView";
import type { AuditBundle, AuditType } from "@/lib/api";

const TAB_PRINT_LABEL: Record<AuditType, string> = {
  cro: "Conversion",
  seo: "SEO",
  compliance: "Trust & Policy",
  gmc: "Google Merchant",
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.API_BASE_INTERNAL ||
    "http://localhost:8050"
  );
}

async function fetchBundle(slug: string): Promise<AuditBundle | null> {
  try {
    const r = await fetch(`${apiBase()}/api/public/audits/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    return (await r.json()) as AuditBundle;
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
  const b = await fetchBundle(slug);
  if (!b) {
    return { title: "Audit not found — Cartlift", robots: { index: false } };
  }
  const host = normalizeHost(b.url);
  const totalFindings = Object.values(b.audits).reduce(
    (s, a) => s + (a?.findings?.length ?? 0),
    0,
  );
  const types = Object.keys(b.audits).join(" · ");
  const title = `${host} — ${types} audit · ${totalFindings} findings · Cartlift`;
  const description = `Free public audit for ${host}. Conversion, SEO, trust and Google Merchant lenses, all on one page. ${totalFindings} annotated findings.`;
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
  const b = await fetchBundle(slug);
  if (!b) notFound();

  const host = normalizeHost(b.url);
  // Total predicted lift across all audit types (CRO contributes most; others are usually 0).
  const totalLift = Object.values(b.audits).reduce(
    (s, a) => s + (a?.findings?.reduce((t, f) => t + (f.predicted_lift_pct || 0), 0) ?? 0),
    0,
  );
  const totalElapsedMs = Object.values(b.audits).reduce(
    (s, a) => s + (a?.elapsed_ms ?? 0),
    0,
  );
  const totalFindings = Object.values(b.audits).reduce(
    (s, a) => s + (a?.findings?.length ?? 0),
    0,
  );

  const claimHref = `/signup?audit=${encodeURIComponent(b.url)}&claim=${b.group_slug}`;

  // Stay dynamic per request — share recipient gets fresh metadata.
  await headers();

  // First non-empty audit's page_title is the best representative.
  const pageTitle = Object.values(b.audits).find((a) => a?.page_title)?.page_title || "";

  return (
    <main className="audit-public">
      <nav className="audit-pub-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">C</span>
          cartlift
        </Link>
        <Link href={claimHref} className="btn btn-lime">audit your store →</Link>
      </nav>

      {/* Print-only header for the PDF export */}
      <div className="audit-pub-print-header" aria-hidden>
        <div className="print-brand">cartlift</div>
        <div className="print-meta">
          {host} · audit report ·{" "}
          <span data-print-active-label>{TAB_PRINT_LABEL.cro}</span>
        </div>
      </div>

      <div className="shell-tight">
        <div className="eyebrow">free public audit · all four lenses</div>
        <h1 className="audit-pub-h1">
          <span className="audit-pub-host">{host}</span>
          <span className="audit-pub-h1-sub">/ {totalFindings} findings across 4 reports</span>
        </h1>

        <div className="audit-pub-meta">
          <span><strong>{(totalElapsedMs / 1000).toFixed(1)}s</strong> · 4 audits in parallel</span>
          <span className="dot">·</span>
          <span>
            predicted lift if all shipped:{" "}
            <strong style={{ color: "var(--lime)" }}>+{totalLift.toFixed(1)}%</strong>
          </span>
          <span className="dot">·</span>
          <span>{new Date(b.created_at).toLocaleDateString()}</span>
        </div>

        {pageTitle && (
          <p className="audit-pub-title">page title: <em>{pageTitle}</em></p>
        )}

        <BundleView bundle={b} claimHref={claimHref} />

        <section className="audit-pub-footer">
          <div className="audit-pub-share">
            <span className="mono">share this audit</span>
            <code className="mono">cartlift.dev/audit/{b.group_slug}</code>
          </div>
          <p className="lede" style={{ marginTop: 24 }}>
            Cartlift is the open-source CRO platform for ecommerce. Audits any
            store URL across conversion, SEO, trust and Google Merchant, drafts
            page variants, ships them via a JS snippet, and runs Thompson-sampled
            A/B tests. MIT licensed.{" "}
            <Link href="/" style={{ color: "var(--lime)" }}>see how it works →</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
