"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, audits, sites as sitesApi, type Audit, type Site } from "@/lib/api";
import SeoReport from "./SeoReport";

const TYPE_LABEL: Record<string, string> = {
  cro: "Conversion Rate",
  seo: "SEO",
  compliance: "Site Compliance",
  gmc: "Google Merchant Center & Site Compliance",
};

function buildMarkdown(a: Audit): string {
  const lines: string[] = [];
  lines.push(`# ${TYPE_LABEL[a.audit_type] ?? a.audit_type.toUpperCase()} Audit`);
  lines.push("");
  lines.push(`**Audit date:** ${new Date(a.created_at).toLocaleDateString()}`);
  lines.push(`**Store URL:** ${a.url}`);
  lines.push(`**Type:** ${a.audit_type.toUpperCase()}`);
  lines.push(`**Elapsed:** ${(a.elapsed_ms / 1000).toFixed(1)}s`);
  lines.push("");
  if (a.summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(a.summary);
    lines.push("");
  }
  if (a.report?.crawled?.length) {
    lines.push("## Pages we read");
    lines.push("");
    for (const p of a.report.crawled) {
      const labels = (p.labels ?? [p.label]).join(" + ");
      lines.push(`- **[${labels}]** ${p.url}`);
    }
    lines.push("");
  }
  if (a.findings?.length) {
    lines.push("## Findings");
    lines.push("");
    for (const f of a.findings) {
      lines.push(`### [${f.surface}] ${f.label}`);
      lines.push(`- **Severity:** ${f.severity}`);
      if (f.predicted_lift_pct) lines.push(`- **Predicted lift:** +${f.predicted_lift_pct}%`);
      lines.push(`- ${f.note}`);
      lines.push("");
    }
  }
  if (a.report?.areas?.length) {
    lines.push("## GMC eligibility risks (observed on the website)");
    lines.push("");
    for (const s of a.report.areas) {
      lines.push(`### ${s.title}`);
      lines.push("**Findings:**");
      lines.push(s.finding);
      if (s.recommendations?.length) {
        lines.push("**Recommendations:**");
        for (const r of s.recommendations) lines.push(`- ${r}`);
      }
      lines.push("");
    }
  }
  if (a.report?.checks?.length) {
    lines.push("## Website compliance checks");
    lines.push("");
    for (const c of a.report.checks) {
      lines.push(`- ${c.ok ? "✓" : "✗"} **${c.item}**${c.note ? " — " + c.note : ""}`);
    }
    lines.push("");
  }
  if (a.report?.sections?.length) {
    lines.push("## Website audit details");
    lines.push("");
    for (const s of a.report.sections) {
      lines.push(`### ${s.title}`);
      lines.push("**Findings:**");
      lines.push(s.finding);
      if (s.recommendations?.length) {
        lines.push("**Recommendations:**");
        for (const r of s.recommendations) lines.push(`- ${r}`);
      }
      lines.push("");
    }
  }
  if (a.report?.conclusion?.length) {
    lines.push("## Conclusion");
    lines.push("");
    for (const c of a.report.conclusion) lines.push(`- ${c}`);
    lines.push("");
  }
  return lines.join("\n");
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AuditDetailView({ id }: { id: number }) {
  const router = useRouter();
  const [a, setA] = useState<Audit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  useEffect(() => {
    audits.get(id).then(setA).catch((e) => {
      if (e instanceof ApiError) setErr(`could not load (${e.status})`);
    });
    sitesApi.list().then((r) => {
      setSites(Array.isArray(r) ? r : r.results);
    }).catch(() => setSites([]));
  }, [id]);

  async function generateVariants() {
    if (!a || !sites) return;
    let siteId: number | null = null;
    if (sites.length === 0) {
      if (confirm("you need at least one registered site. go register one?")) {
        router.push("/dashboard/sites");
      }
      return;
    }
    if (sites.length === 1) {
      siteId = sites[0].id;
    } else {
      const choice = prompt(
        "which site? (paste the site id from /dashboard/sites)\n\n" +
          sites.map((s) => `  ${s.id}  ${s.domain}`).join("\n"),
      );
      siteId = choice ? Number(choice) : null;
      if (!siteId || !sites.find((s) => s.id === siteId)) return;
    }

    setGenerating(true);
    setGenResult(null);
    try {
      const r = await audits.generateVariants(a.id, siteId);
      setGenResult(`✓ created ${r.created} draft experiments. open Experiments to approve them.`);
    } catch (e) {
      const msg = e instanceof ApiError && typeof (e.data as { detail?: string })?.detail === "string"
        ? (e.data as { detail: string }).detail
        : "could not generate variants";
      setGenResult(`✗ ${msg}`);
    } finally {
      setGenerating(false);
    }
  }

  if (err) return <div className="form-error">{err}</div>;
  if (!a) return <p className="fine">loading…</p>;

  const isLongForm = a.audit_type === "compliance" || a.audit_type === "gmc";
  const isRichSeo = a.audit_type === "seo" && !!a.report?.scores;
  const canGenerate = a.audit_type === "cro" || a.audit_type === "seo";
  const safeUrl = a.url.replace(/[^a-z0-9]/gi, "-").slice(0, 60);

  return (
    <>
      <div className="dash-header">
        <div>
          <h1>{TYPE_LABEL[a.audit_type] ?? a.audit_type} <em>audit.</em></h1>
          <p className="sub">~ {a.url} · ran {new Date(a.created_at).toLocaleString()} · {(a.elapsed_ms / 1000).toFixed(1)}s</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canGenerate && (
            <button
              className="btn btn-lime"
              disabled={generating}
              onClick={generateVariants}
              style={{ padding: "8px 14px" }}
            >
              {generating ? "drafting variants…" : "→ generate variants"}
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() =>
              downloadFile(`bandit-${a.audit_type}-${safeUrl}.md`, buildMarkdown(a), "text/markdown")
            }
          >
            ⤓ download .md
          </button>
          <button
            className="icon-btn"
            onClick={() =>
              downloadFile(`bandit-${a.audit_type}-${safeUrl}.json`, JSON.stringify(a, null, 2), "application/json")
            }
          >
            ⤓ download .json
          </button>
          <button className="icon-btn" onClick={() => window.print()}>
            ⤓ download pdf
          </button>
          <Link href={`/dashboard/audits?type=${a.audit_type}`} className="icon-btn">
            ← back
          </Link>
        </div>
      </div>

      {genResult && (
        <div style={{
          padding: "14px 16px",
          background: genResult.startsWith("✓") ? "var(--lime-soft)" : "var(--red-soft)",
          borderLeft: `2px solid ${genResult.startsWith("✓") ? "var(--lime)" : "var(--red)"}`,
          fontFamily: "var(--mono)",
          fontSize: 14,
          color: genResult.startsWith("✓") ? "var(--lime)" : "var(--red)",
          marginBottom: 18,
          borderRadius: "0 4px 4px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span>{genResult}</span>
          {genResult.startsWith("✓") && (
            <Link href="/dashboard/experiments" className="icon-btn">open experiments →</Link>
          )}
        </div>
      )}

      {/* Rich SEO report (multi-page crawl) */}
      {isRichSeo && (
        <article className="seo-report-doc">
          {/* ---- Print-only cover page ---- */}
          <section className="print-cover seo-print-cover">
            <div className="cover-brand">
              <span className="cover-mark">B</span>
              <span className="cover-name">bandit</span>
            </div>
            <div className="seo-cover-eyebrow">SEO Audit Report</div>
            <h1 className="cover-title">{a.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</h1>

            <div className="seo-cover-score-row">
              <div className="seo-cover-grade">
                <span className="grade-letter">{
                  (a.report?.scores?.overall ?? 0) >= 90 ? "A"
                  : (a.report?.scores?.overall ?? 0) >= 75 ? "B"
                  : (a.report?.scores?.overall ?? 0) >= 60 ? "C"
                  : (a.report?.scores?.overall ?? 0) >= 40 ? "D" : "F"
                }</span>
                <span className="grade-num">{a.report?.scores?.overall ?? 0}<small>/100</small></span>
                <span className="grade-lbl">overall</span>
              </div>
              <div className="seo-cover-scores">
                <div><span>technical</span><strong>{a.report?.scores?.technical ?? 0}</strong></div>
                <div><span>content</span><strong>{a.report?.scores?.content ?? 0}</strong></div>
                <div><span>structured data</span><strong>{a.report?.scores?.structured_data ?? 0}</strong></div>
                <div><span>performance</span><strong>{a.report?.scores?.performance ?? 0}</strong></div>
              </div>
            </div>

            <div className="cover-details">
              <h4>Audit details</h4>
              <p><strong>Site:</strong> <a href={a.url}>{a.url}</a></p>
              <p><strong>Audit date:</strong> {new Date(a.created_at).toLocaleString()}</p>
              <p><strong>Pages crawled:</strong> {a.report?.pages?.length ?? 0}</p>
              <p><strong>Elapsed:</strong> {(a.elapsed_ms / 1000).toFixed(1)}s</p>
              <p><strong>Checks:</strong> {(a.report?.checks?.length ?? 0) - (a.report?.checks?.filter((c) => !c.ok).length ?? 0)} passing · {a.report?.checks?.filter((c) => !c.ok).length ?? 0} failing of {a.report?.checks?.length ?? 0}</p>
            </div>

            <div className="cover-about">
              <h4>About this report</h4>
              <p>
                This is a multi-page SEO audit produced by Bandit. We crawled up to {a.report?.pages?.length ?? 0} pages of
                your site, captured every per-page SEO signal (titles, metas, H1s, schemas, canonicals,
                response headers, content density), and aggregated them into the diagnostics + scores below.
              </p>
              <p>
                Each finding is grounded in real data from your site — page URLs, byte counts, response times,
                and structured-data types are all included so your engineering team can act on them directly.
              </p>
              <p><strong>This report contains:</strong></p>
              <ol>
                <li>Search preview — how your homepage looks in Google</li>
                <li>Site diagnostics + scores per axis</li>
                <li>Crawled pages table with per-page detail</li>
                <li>Top opportunities (sorted by impact)</li>
                <li>Priority issues with recommendations</li>
                <li>Full pass/fail check list</li>
                <li>Do-this-week conclusion</li>
              </ol>
            </div>
          </section>

          {a.summary && (
            <p className="seo-print-summary mono" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 24, lineHeight: 1.65, padding: "16px 18px", background: "var(--bg-1)", borderLeft: "2px solid var(--lime)", borderRadius: "0 4px 4px 0" }}>
              {a.summary}
            </p>
          )}
          <SeoReport a={a} />
        </article>
      )}

      {/* Short-form view (CRO, and legacy SEO without scores) */}
      {!isLongForm && !isRichSeo && (
        <>
          {a.summary && (
            <p className="mono" style={{ fontSize: 15, color: "var(--ink-2)", marginBottom: 24, lineHeight: 1.65, padding: "16px 18px", background: "var(--bg-1)", borderLeft: "2px solid var(--lime)", borderRadius: "0 4px 4px 0" }}>
              {a.summary}
            </p>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {a.findings.map((f, i) => (
              <div key={i} style={{
                padding: "16px 18px",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderLeft: `3px solid ${f.severity === "high" ? "var(--red)" : f.severity === "medium" ? "var(--warn)" : "var(--ink-3)"}`,
                borderRadius: 4,
                boxShadow: "var(--shadow-md)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>
                    [{f.surface}] {f.label}
                  </span>
                  {f.predicted_lift_pct > 0 && (
                    <span className="mono fine" style={{ color: "var(--lime)", fontWeight: 600 }}>
                      predicted +{f.predicted_lift_pct}%
                    </span>
                  )}
                </div>
                <p className="mono" style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.7 }}>
                  {f.note}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Long-form view (Compliance + GMC) — KeyCommerce-style report */}
      {isLongForm && (
        <article className="report-doc">
          {/* ---- Print-only cover page ---- */}
          <section className="print-cover">
            <div className="cover-brand">
              <span className="cover-mark">B</span>
              <span className="cover-name">bandit</span>
            </div>
            <h1 className="cover-title">
              {a.audit_type === "gmc"
                ? "Google Merchant Center & Site Compliance Audit"
                : "Site Compliance Audit"}
            </h1>
            <div className="cover-details">
              <h4>Audit details:</h4>
              <p><strong>Audit date:</strong> {new Date(a.created_at).toLocaleDateString()}</p>
              <p><strong>Store URL:</strong> <a href={a.url}>{a.url}</a></p>
              <p><strong>Elapsed:</strong> {(a.elapsed_ms / 1000).toFixed(1)}s · pages crawled: {a.report?.crawled?.length ?? 1}</p>
            </div>
            <div className="cover-about">
              <h4>About the audit</h4>
              <p>
                {a.audit_type === "gmc"
                  ? "This audit reviews your public website for the signals Google Merchant Center reviewers use when evaluating eligibility — misrepresentation, pricing alignment, return-policy consistency, checkout transparency, and contact-info integrity. We crawl the same pages a reviewer would read."
                  : "Our compliance audit reviews your storefront against the trust + transparency standards expected by major commerce platforms (Google Shopping, Meta, payment processors). Each section ends with concrete actions you can apply this week."}
              </p>
              <p>
                {a.audit_type === "gmc"
                  ? "Bandit does NOT have access to your Google Merchant Center account, product feed, or diagnostics tab. We do not invent suspension messages or affected-item counts. Every finding below is observable from the pages we crawled."
                  : "Under each section we provide what we found and concrete recommendations to improve."}
              </p>
              <p>
                Recommendations are written for the BEST chance of avoiding policy issues. Even if other sites get away with these gaps today, platform enforcement changes — we recommend closing every flagged gap.
              </p>
              <p>
                <strong>What this audit covers:</strong>
              </p>
              <ol>
                {a.audit_type === "gmc" && <li>Cross-page contradictions that drive misrepresentation risk</li>}
                <li>Website trust + transparency checklist</li>
              </ol>
            </div>
          </section>

          {/* ---- Screen-only summary header ---- */}
          <h2 className="no-print">{TYPE_LABEL[a.audit_type]} audit</h2>
          <p className="no-print">
            <strong>Audit date:</strong> {new Date(a.created_at).toLocaleDateString()}<br />
            <strong>Store URL:</strong> {a.url}<br />
            <strong>Elapsed:</strong> {(a.elapsed_ms / 1000).toFixed(1)}s
          </p>

          <h3 className="no-print">About this audit</h3>
          <p className="no-print">
            {a.audit_type === "gmc"
              ? "We crawl the public pages a Google Merchant Center policy reviewer would read — homepage, returns, shipping, privacy, terms, about, contact, cart, checkout — and surface the cross-page contradictions and missing trust signals most likely to put your eligibility at risk."
              : "Our compliance audit reviews your site against the trust + transparency standards expected by major platforms (Google Shopping, Meta, payment processors). Each section ends with concrete actions you can apply this week."}
          </p>
          <p className="no-print">
            Recommendations are written for the BEST chance of fixing your issue. Even if other
            sites get away with these gaps today, there is no guarantee they always will.
          </p>

          {a.report?.crawled?.length ? (
            <div className="no-print">
              <h3>Pages we read</h3>
              <p style={{ color: "var(--ink-3)", fontSize: 15 }}>
                The auditor crawled the homepage and key policy pages, then compared them
                for cross-page contradictions. These are the {a.report.crawled.length} pages it inspected:
              </p>
              <ul style={{ fontFamily: "var(--mono)", fontSize: 14, lineHeight: 1.85 }}>
                {a.report.crawled.map((p) => (
                  <li key={p.url}>
                    <span style={{ color: "var(--lime)", fontWeight: 600 }}>
                      [{(p.labels ?? [p.label]).join(" + ")}]
                    </span>{" "}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-2)" }}>
                      {p.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {a.audit_type === "gmc" ? (
            <div className="gmc-scope-note no-print">
              <strong>Scope of this audit.</strong> Bandit does not have access
              to your Google Merchant Center account, product feed, or
              diagnostics tab. Every risk below is observed by reading your
              public website — the same pages a Google policy reviewer reads
              when evaluating eligibility.
            </div>
          ) : null}

          {a.audit_type === "gmc" && a.report?.ai_analysis === false ? (
            <div className="gmc-no-llm-note no-print">
              <strong>Deeper LLM analysis was not run.</strong> The auto-detected
              checklist below is fully populated, but cross-page contradiction
              analysis (rewritten copy, multi-page wording mismatches) requires
              an Anthropic API key. Set <code>ANTHROPIC_API_KEY</code> on the
              API container and re-run this audit for richer findings.
            </div>
          ) : null}

          {a.report?.areas?.length ? (
            <section>
              <h2>{a.audit_type === "gmc" ? "A. GMC eligibility risks observed on your website" : "Outcomes"}</h2>
              <p>
                {a.audit_type === "gmc"
                  ? "These are the website-level signals most likely to put your GMC eligibility at risk. They were inferred by cross-comparing the pages we crawled — not pulled from any GMC account."
                  : "In this section of the audit, we analyse the key contributing factors that may put your storefront at risk with platform reviewers."}
              </p>
              {a.report.areas.map((s, i) => (
                <div key={i} className="report-section">
                  <h3>{i + 1}. {s.title}</h3>
                  <div className="findings-block">
                    <h4>findings</h4>
                    <p style={{ marginBottom: 0 }}>{s.finding}</p>
                  </div>
                  {s.recommendations?.length ? (
                    <div className="findings-block lime">
                      <h4>recommendations</h4>
                      <ul>
                        {s.recommendations.map((r, j) => <li key={j}>{r}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {a.report?.checks?.length ? (
            <section className="page-break-before">
              <h2>{a.report?.areas?.length ? "B. Auto-detected compliance checklist" : "Compliance checks"}</h2>
              <p>
                {a.audit_type === "gmc"
                  ? "Every check below is computed automatically by reading the crawled HTML — payment-icon detection, guest-checkout vs forced sign-in, contact-email consistency, return-window language, and so on. No LLM is involved in this section, so the results are deterministic and verifiable."
                  : "Website-related issues are the most common cause of platform-policy disputes. We reviewed the crawled pages for trust, transparency, and consistency signals."}
              </p>
              <table className="check-table">
                <tbody>
                  {a.report.checks.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <div className="check-item">{c.item}</div>
                        {c.note && <div className="check-note-line">{c.note}</div>}
                      </td>
                      <td className={c.ok ? "ok" : "bad"}>{c.ok ? "✓" : "✗"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {a.report?.sections?.length ? (
            <section className="page-break-before">
              <h2>{a.report?.checks?.length ? "Outcomes of the Website Audit" : "Detailed findings"}</h2>
              {a.report.sections.map((s, i) => (
                <div key={i} className="report-section">
                  <h3>{i + 1}. {s.title}</h3>
                  <div className="findings-block">
                    <h4>findings</h4>
                    <p style={{ marginBottom: 0 }}>{s.finding}</p>
                  </div>
                  {s.recommendations?.length ? (
                    <div className="findings-block lime">
                      <h4>recommendations</h4>
                      <ul>
                        {s.recommendations.map((r, j) => <li key={j}>{r}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {a.report?.conclusion?.length ? (
            <section className="page-break-before">
              <h2>Conclusion</h2>
              <ul className="conclusion-list">
                {a.report.conclusion.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 15 }}>
                Once the changes are complete, you can request a manual review from the relevant
                platform and continue to monitor the account to ensure it remains compliant.
              </p>
            </section>
          ) : null}
        </article>
      )}
    </>
  );
}
