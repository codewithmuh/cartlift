"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, audits, sites as sitesApi, type Audit, type Site } from "@/lib/api";

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
  if (a.report?.messages?.length) {
    lines.push("## GMC Diagnostics");
    lines.push("");
    lines.push("| Type | Description | Affected |");
    lines.push("|------|-------------|----------|");
    for (const m of a.report.messages) {
      lines.push(`| ${m.type} | ${m.description} | ${m.affected} |`);
    }
    lines.push("");
  }
  if (a.report?.areas?.length) {
    lines.push("## Account areas");
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
          fontSize: 12,
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

      {/* Short-form view (CRO + SEO) */}
      {!isLongForm && (
        <>
          {a.summary && (
            <p className="mono" style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 24, lineHeight: 1.65, padding: "16px 18px", background: "var(--bg-1)", borderLeft: "2px solid var(--lime)", borderRadius: "0 4px 4px 0" }}>
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
                  <span className="mono" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                    [{f.surface}] {f.label}
                  </span>
                  {f.predicted_lift_pct > 0 && (
                    <span className="mono fine" style={{ color: "var(--lime)", fontWeight: 600 }}>
                      predicted +{f.predicted_lift_pct}%
                    </span>
                  )}
                </div>
                <p className="mono" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.7 }}>
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
                  ? "Our Google Merchant Center Audit covers the Google Merchant Center account, your product feed, and your website. We review these three areas carefully to uncover the cause of your suspension or account issues. Sometimes there's just one leading cause, but often the reason involves many factors."
                  : "Our compliance audit reviews your storefront against the trust + transparency standards expected by major commerce platforms (Google Shopping, Meta, payment processors). Each section ends with concrete actions you can apply this week."}
              </p>
              <p>
                Under each section, we'll provide our results and recommendations to improve the error
                and give your store the best chance of fixing your account issues.
              </p>
              <p>
                Please keep in mind that the recommendations are to offer you the BEST chance of fixing the
                disapproval. We recommend you fix every issue and go above and beyond to improve your website.
                Best practices and platform policies guide our recommendations, insights, and findings.
              </p>
              <p>
                <strong>In this audit, we cover {a.audit_type === "gmc" ? "2" : "1"} key area{a.audit_type === "gmc" ? "s" : ""} of your account:</strong>
              </p>
              <ol>
                {a.audit_type === "gmc" && <li>Google Merchant Center Diagnostics</li>}
                <li>Website and Content</li>
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
              ? "Our Google Merchant Center audit covers the GMC account, your product feed, and your website. We review these three areas to uncover the cause of your suspension or account issues. Sometimes there's one leading cause, but often the reason involves many factors."
              : "Our compliance audit reviews your site against the trust + transparency standards expected by major platforms (Google Shopping, Meta, payment processors). Each section ends with concrete actions you can apply this week."}
          </p>
          <p className="no-print">
            Recommendations are written for the BEST chance of fixing your issue. Even if other
            sites get away with these gaps today, there is no guarantee they always will.
          </p>

          {a.report?.crawled?.length ? (
            <div className="no-print">
              <h3>Pages we read</h3>
              <p style={{ color: "var(--ink-3)", fontSize: 13 }}>
                The auditor crawled the homepage and key policy pages, then compared them
                for cross-page contradictions. These are the {a.report.crawled.length} pages it inspected:
              </p>
              <ul style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.85 }}>
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

          {a.report?.messages?.length ? (
            <section className="page-break-before">
              <h2>A. Google Merchant Center Audit</h2>
              <p>
                We have accessed the Google Merchant Center account and reviewed the
                diagnostics tab to identify any errors that appear. In this section, we can
                find 3 types of messages from Google:
              </p>
              <ul>
                <li>Notifications (mostly suggestions from Google to improve your data feed)</li>
                <li>Warnings (these are not a sign of product disapproval, but something to fix if possible)</li>
                <li>Errors (these need to be fixed right away)</li>
              </ul>
              <p>Messages found in the Diagnostics tab:</p>
              <p>Messages found in the Diagnostics tab:</p>
              <table className="diagnostics-table">
                <thead>
                  <tr>
                    <th>Type of Message</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Affected Items</th>
                  </tr>
                </thead>
                <tbody>
                  {a.report.messages.map((m, i) => (
                    <tr key={i}>
                      <td className={`msg-type msg-${m.type.toLowerCase()}`}>{m.type}</td>
                      <td>{m.description}</td>
                      <td style={{ textAlign: "right" }}>{m.affected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {a.report?.areas?.length ? (
            <section>
              <h2>{a.report?.messages?.length ? "Outcomes of the Google Merchant Center Audit" : "Outcomes"}</h2>
              <p>
                In this section of the audit, we analyse the key contributing factors that
                may be resulting in your account&apos;s suspension.
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
              <h2>{a.report?.areas?.length ? "B. Website audit" : "Compliance checks"}</h2>
              <p>
                Website-related issues cause a large number of Google Merchant Center
                suspensions. We reviewed the website to determine whether the warnings
                flagged by Google could be linked to missing information, inaccurate
                representation, poor user experience, or other potential issues that may
                impact trust and compliance.
              </p>
              <p>Here are the results for your store:</p>
              <table className="check-table">
                <tbody>
                  {a.report.checks.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.item}
                        {c.note && !c.ok && (
                          <span className="check-note"> — See "Results" below for details</span>
                        )}
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
              <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 13 }}>
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
