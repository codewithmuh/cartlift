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
            ⤓ print / pdf
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

      {/* Long-form view (Compliance + GMC) — Yoonlab-style report */}
      {isLongForm && (
        <article className="report-doc">
          <h2>{TYPE_LABEL[a.audit_type]} audit</h2>
          <p>
            <strong>Audit date:</strong> {new Date(a.created_at).toLocaleDateString()}<br />
            <strong>Store URL:</strong> {a.url}<br />
            <strong>Elapsed:</strong> {(a.elapsed_ms / 1000).toFixed(1)}s
          </p>

          <h3>About this audit</h3>
          <p>
            {a.audit_type === "gmc"
              ? "Our Google Merchant Center audit covers the GMC account, your product feed, and your website. We review these three areas to uncover the cause of your suspension or account issues. Sometimes there's one leading cause, but often the reason involves many factors."
              : "Our compliance audit reviews your site against the trust + transparency standards expected by major platforms (Google Shopping, Meta, payment processors). Each section ends with concrete actions you can apply this week."}
          </p>
          <p>
            Recommendations are written for the BEST chance of fixing your issue. Even if other
            sites get away with these gaps today, there is no guarantee they always will.
          </p>

          {a.report?.messages?.length ? (
            <>
              <h2>A. Diagnostics</h2>
              <p>Messages found in the diagnostics tab:</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr style={{ background: "var(--bg-1)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.06em" }}>Type</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.06em" }}>Description</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--hairline)", color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.06em" }}>Affected</th>
                  </tr>
                </thead>
                <tbody>
                  {a.report.messages.map((m, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--hairline)", color: m.type === "Error" ? "var(--red)" : m.type === "Warning" ? "var(--warn)" : "var(--ink-2)", fontWeight: 600 }}>{m.type}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--hairline)", color: "var(--ink)" }}>{m.description}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--hairline)", color: "var(--ink)", textAlign: "right" }}>{m.affected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {a.report?.areas?.length ? (
            <>
              <h2>{a.report?.messages?.length ? "Outcomes — account review" : "Outcomes"}</h2>
              {a.report.areas.map((s, i) => (
                <div key={i}>
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
            </>
          ) : null}

          {a.report?.checks?.length ? (
            <>
              <h2>{a.report?.areas?.length ? "B. Website audit" : "Compliance checks"}</h2>
              <p>
                Website-related issues cause the most platform suspensions. We reviewed the
                site to determine whether the warnings could be linked to missing information,
                inaccurate representation, poor user experience, or other potential trust issues.
              </p>
              <p>Here are the results for your store:</p>
              <div style={{ marginTop: 12 }}>
                {a.report.checks.map((c, i) => (
                  <div key={i} className="check-row">
                    <span style={{ color: "var(--ink-2)" }}>
                      {c.item}
                      {c.note && <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>— {c.note}</span>}
                    </span>
                    <span className={c.ok ? "ok" : "bad"}>{c.ok ? "✓" : "✗ see below"}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {a.report?.sections?.length ? (
            <>
              <h2>{a.report?.checks?.length ? "Outcomes — website review" : "Detailed findings"}</h2>
              {a.report.sections.map((s, i) => (
                <div key={i}>
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
            </>
          ) : null}

          {a.report?.conclusion?.length ? (
            <>
              <h2>Conclusion</h2>
              <ul>
                {a.report.conclusion.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 13 }}>
                Once the changes are complete, you can request a manual review and continue to
                monitor the account to ensure it remains compliant.
              </p>
            </>
          ) : null}
        </article>
      )}
    </>
  );
}
