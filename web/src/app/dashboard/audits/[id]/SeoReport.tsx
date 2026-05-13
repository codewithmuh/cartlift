"use client";

import { Fragment, useState } from "react";
import type { Audit, SeoPage, SeoOpportunity, SeoKeyword, SeoSearchPreview, SeoContentStats } from "@/lib/api";

function gradeFor(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: "A", color: "var(--lime)" };
  if (score >= 75) return { letter: "B", color: "var(--lime-2)" };
  if (score >= 60) return { letter: "C", color: "var(--warn)" };
  if (score >= 40) return { letter: "D", color: "var(--warn)" };
  return { letter: "F", color: "var(--red)" };
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "");
    return path + (u.search || "");
  } catch {
    return url;
  }
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function fmtKB(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtMs(ms: number | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ScoreTile({ label, score }: { label: string; score: number | undefined }) {
  const s = score ?? 0;
  const g = gradeFor(s);
  return (
    <div className="seo-score-tile">
      <span className="seo-score-label">{label}</span>
      <div className="seo-score-value">
        <span className="num" style={{ color: g.color }}>{s}</span>
        <span className="grade" style={{ background: g.color }}>{g.letter}</span>
      </div>
      <div className="seo-score-bar">
        <span style={{ width: `${s}%`, background: g.color }} />
      </div>
    </div>
  );
}

export default function SeoReport({ a }: { a: Audit }) {
  const r = a.report;
  const scores = r?.scores;
  const site = r?.site;
  // Prefer `pages` (the rich new shape); fall back to `crawled` for audits run
  // before the field rename so existing rows still render.
  const crawled: SeoPage[] = (r?.pages || (r?.crawled as unknown as SeoPage[]) || []) as SeoPage[];
  const searchPreview = r?.search_preview;
  const topKeywords: SeoKeyword[] = r?.top_keywords || [];
  const contentStats = r?.content_stats;
  const checks = r?.checks || [];
  const sections = r?.sections || [];
  const opps: SeoOpportunity[] = r?.opportunities || [];
  const conclusion = r?.conclusion || [];

  const [expanded, setExpanded] = useState<string | null>(null);

  if (!scores) {
    // Old audit without the rich report — caller should render the legacy view.
    return null;
  }

  const overall = gradeFor(scores.overall);
  const failed = checks.filter((c) => !c.ok);
  const passed = checks.length - failed.length;

  return (
    <div className="seo-report">
      {/* ---- Header card with overall grade + summary ---- */}
      <div className="seo-hero">
        <div className="seo-hero-grade" style={{ borderColor: overall.color }}>
          <span className="grade-letter" style={{ color: overall.color }}>{overall.letter}</span>
          <span className="grade-num">{scores.overall}<small>/100</small></span>
          <span className="grade-label">overall SEO score</span>
        </div>
        <div className="seo-hero-meta">
          <div className="seo-hero-row">
            <span className="lbl">site</span>
            <strong>{host(a.url)}</strong>
          </div>
          <div className="seo-hero-row">
            <span className="lbl">pages crawled</span>
            <strong>{crawled.length}</strong>
          </div>
          <div className="seo-hero-row">
            <span className="lbl">checks passing</span>
            <strong>{passed} <span style={{ color: "var(--ink-4)" }}>of {checks.length}</span></strong>
          </div>
          <div className="seo-hero-row">
            <span className="lbl">priority issues</span>
            <strong style={{ color: failed.length ? "var(--red)" : "var(--lime)" }}>{failed.length}</strong>
          </div>
          <div className="seo-hero-row">
            <span className="lbl">audited</span>
            <strong>{(a.elapsed_ms / 1000).toFixed(1)}s</strong>
          </div>
        </div>
      </div>

      {/* ---- 4 score tiles ---- */}
      <div className="seo-score-grid">
        <ScoreTile label="technical" score={scores.technical} />
        <ScoreTile label="content" score={scores.content} />
        <ScoreTile label="structured data" score={scores.structured_data} />
        <ScoreTile label="performance" score={scores.performance} />
      </div>

      {/* ---- SERP search preview ---- */}
      {searchPreview && <SearchPreviewCard preview={searchPreview} />}

      {/* ---- Content stats + top keywords ---- */}
      {(contentStats || topKeywords.length > 0) && (
        <div className="seo-stats-row">
          {contentStats && <ContentStatsCard stats={contentStats} />}
          {topKeywords.length > 0 && <KeywordsCard keywords={topKeywords} />}
        </div>
      )}

      {/* ---- Site-wide diagnostics ---- */}
      {site && (
        <div className="seo-block">
          <h2 className="seo-block-h">site diagnostics</h2>
          <div className="seo-diag-grid">
            <DiagTile
              label="HTTPS"
              ok={site.https}
              detail={site.https ? "all good" : "serving over http"}
            />
            <DiagTile
              label="robots.txt"
              ok={site.robots_txt?.present}
              detail={site.robots_txt?.present
                ? `${site.robots_txt.disallow_count ?? 0} disallow rules · ${site.robots_txt.sitemaps?.length ?? 0} sitemap refs`
                : "no /robots.txt"}
            />
            <DiagTile
              label="sitemap.xml"
              ok={site.sitemap_xml?.present}
              detail={site.sitemap_xml?.present
                ? `${site.sitemap_xml.url_count ?? "?"} urls`
                : "no sitemap found"}
            />
            <DiagTile
              label="duplicate titles"
              ok={site.duplicate_titles.length === 0}
              detail={site.duplicate_titles.length === 0 ? "none" : `${site.duplicate_titles.length} groups`}
            />
            <DiagTile
              label="missing meta desc"
              ok={site.pages_missing_meta.length === 0}
              detail={site.pages_missing_meta.length === 0 ? "all set" : `${site.pages_missing_meta.length} pages`}
            />
            <DiagTile
              label="missing H1"
              ok={site.pages_missing_h1.length === 0}
              detail={site.pages_missing_h1.length === 0 ? "all set" : `${site.pages_missing_h1.length} pages`}
            />
            <DiagTile
              label="missing canonical"
              ok={site.pages_missing_canonical.length === 0}
              detail={site.pages_missing_canonical.length === 0 ? "all set" : `${site.pages_missing_canonical.length} pages`}
            />
            <DiagTile
              label="thin content"
              ok={site.pages_thin.length === 0}
              detail={site.pages_thin.length === 0 ? "all set" : `${site.pages_thin.length} <250 words`}
            />
            <DiagTile
              label="schema coverage"
              ok={site.pages_no_schema.length === 0}
              detail={site.pages_no_schema.length === 0 ? "all pages have schema" : `${site.pages_no_schema.length} pages w/o schema`}
            />
            <DiagTile
              label="slow pages"
              ok={site.slow_pages.length === 0}
              detail={site.slow_pages.length === 0 ? "all <1.5s" : `${site.slow_pages.length} pages >1.5s`}
            />
            <DiagTile
              label="4xx responses"
              ok={site.pages_4xx.length === 0}
              detail={site.pages_4xx.length === 0 ? "none" : `${site.pages_4xx.length} urls`}
            />
            <DiagTile
              label="5xx responses"
              ok={site.pages_5xx.length === 0}
              detail={site.pages_5xx.length === 0 ? "none" : `${site.pages_5xx.length} urls`}
            />
            <DiagTile
              label="www / non-www unified"
              ok={site.www_canonicalization?.unified !== false}
              detail={site.www_canonicalization?.unified === false ? "both resolve" : "yes"}
            />
            <DiagTile
              label="compression"
              ok={!site.pages_no_compression || site.pages_no_compression.length === 0}
              detail={
                !site.pages_no_compression || site.pages_no_compression.length === 0
                  ? "gzip / brotli on"
                  : `${site.pages_no_compression.length} pages uncompressed`
              }
            />
            <DiagTile
              label="title pixel width"
              ok={!site.pages_long_title || site.pages_long_title.length === 0}
              detail={
                !site.pages_long_title || site.pages_long_title.length === 0
                  ? "all ≤ 580px"
                  : `${site.pages_long_title.length} titles too long`
              }
            />
            <DiagTile
              label="meta pixel width"
              ok={!site.pages_long_meta || site.pages_long_meta.length === 0}
              detail={
                !site.pages_long_meta || site.pages_long_meta.length === 0
                  ? "all ≤ 990px"
                  : `${site.pages_long_meta.length} metas too long`
              }
            />
            <DiagTile
              label="favicon"
              ok={!site.pages_no_favicon || site.pages_no_favicon.length === 0}
              detail={
                !site.pages_no_favicon || site.pages_no_favicon.length === 0
                  ? "all set"
                  : `${site.pages_no_favicon.length} missing`
              }
            />
            <DiagTile
              label="doctype"
              ok={!site.pages_no_doctype || site.pages_no_doctype.length === 0}
              detail={
                !site.pages_no_doctype || site.pages_no_doctype.length === 0
                  ? "html5 declared"
                  : `${site.pages_no_doctype.length} missing`
              }
            />
            <DiagTile
              label="charset"
              ok={!site.pages_no_charset || site.pages_no_charset.length === 0}
              detail={
                !site.pages_no_charset || site.pages_no_charset.length === 0
                  ? "declared"
                  : `${site.pages_no_charset.length} missing`
              }
            />
            <DiagTile
              label="session IDs in URLs"
              ok={!site.pages_with_session_id || site.pages_with_session_id.length === 0}
              detail={
                !site.pages_with_session_id || site.pages_with_session_id.length === 0
                  ? "none"
                  : `${site.pages_with_session_id.length} urls`
              }
            />
          </div>
        </div>
      )}

      {/* ---- Crawled pages table ---- */}
      <div className="seo-block">
        <h2 className="seo-block-h">crawled pages <span className="seo-block-count">({crawled.length})</span></h2>
        <div className="seo-table-wrap">
          <table className="seo-pages-table">
            <thead>
              <tr>
                <th>page</th>
                <th>status</th>
                <th>title</th>
                <th>meta</th>
                <th>H1</th>
                <th>schema</th>
                <th>words</th>
                <th>speed</th>
                <th>size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {crawled.map((p, i) => {
                const key = `${p.url}-${i}`;
                const open = expanded === key;
                const status = p.status || 0;
                const statusColor =
                  status === 200 ? "var(--lime)"
                    : status >= 500 ? "var(--red)"
                    : status >= 400 ? "var(--red)"
                    : status >= 300 ? "var(--warn)"
                    : "var(--ink-4)";
                return (
                  <Fragment key={key}>
                    <tr className={open ? "is-open" : ""}>
                      <td className="seo-cell-url" title={p.url}>{shortPath(p.url)}</td>
                      <td><span style={{ color: statusColor, fontWeight: 600 }}>{status || "—"}</span></td>
                      <td>
                        <span className={`pill ${p.title ? "pass" : "fail"}`}>
                          {p.title ? `${p.title_length} chars` : "missing"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${p.meta_description ? "pass" : "fail"}`}>
                          {p.meta_description ? `${p.meta_description_length} chars` : "missing"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${p.h1_count === 1 ? "pass" : p.h1_count > 1 ? "warn" : "fail"}`}>
                          {p.h1_count === 0 ? "none" : p.h1_count === 1 ? "1" : `${p.h1_count} ×`}
                        </span>
                      </td>
                      <td>
                        {p.schema_types && p.schema_types.length > 0 ? (
                          <span className="pill pass">{p.schema_types.length} schema{p.schema_types.length === 1 ? "" : "s"}</span>
                        ) : (
                          <span className="pill fail">none</span>
                        )}
                      </td>
                      <td className="seo-cell-num">{p.word_count?.toLocaleString() || "—"}</td>
                      <td className="seo-cell-num">{fmtMs(p.response_ms)}</td>
                      <td className="seo-cell-num">{fmtKB(p.byte_size)}</td>
                      <td>
                        <button
                          className="seo-expand-btn"
                          onClick={() => setExpanded(open ? null : key)}
                          aria-label={open ? "collapse" : "expand"}
                        >
                          {open ? "−" : "+"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="seo-page-detail-row">
                        <td colSpan={10}>
                          <PageDetail page={p} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Top opportunities ---- */}
      {opps.length > 0 && (
        <div className="seo-block">
          <h2 className="seo-block-h">top opportunities</h2>
          <div className="seo-opps">
            {opps.map((o, i) => (
              <div key={i} className={`seo-opp sev-${o.severity}`}>
                <div className="seo-opp-head">
                  <span className={`sev sev-${o.severity}`}>● {o.severity}</span>
                  <span className="surface">{o.surface}</span>
                  <span className="effort">
                    effort <strong>{o.effort}</strong> · impact <strong>{o.impact}</strong>
                  </span>
                </div>
                <h3>{o.title}</h3>
                <p>{o.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Sections (long-form priorities) ---- */}
      {sections.length > 0 && (
        <div className="seo-block">
          <h2 className="seo-block-h">priority issues</h2>
          <div className="seo-sections">
            {sections.map((s, i) => (
              <div key={i} className="seo-section">
                <div className="seo-section-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="seo-section-body">
                  <h3>{s.title}</h3>
                  <p>{s.finding}</p>
                  {s.recommendations && s.recommendations.length > 0 && (
                    <>
                      <span className="seo-recs-label">recommendations</span>
                      <ul className="seo-recs">
                        {s.recommendations.map((rec, j) => <li key={j}>{rec}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- All checks (passes + fails) ---- */}
      <div className="seo-block">
        <h2 className="seo-block-h">all checks <span className="seo-block-count">({passed}/{checks.length})</span></h2>
        <ul className="seo-checks">
          {checks.map((c, i) => (
            <li key={i} className={c.ok ? "ok" : "fail"}>
              <span className="dot">{c.ok ? "●" : "○"}</span>
              <span className="item">{c.item}</span>
              {c.note && <span className="note">— {c.note}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Conclusion ---- */}
      {conclusion.length > 0 && (
        <div className="seo-block seo-block-conclusion">
          <h2 className="seo-block-h">do this week</h2>
          <ol className="seo-conclusion">
            {conclusion.map((c, i) => <li key={i}>{c}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function DiagTile({ label, ok, detail }: { label: string; ok: boolean | undefined; detail: string }) {
  return (
    <div className={`seo-diag-tile ${ok ? "ok" : "fail"}`}>
      <span className="dot">{ok ? "●" : "○"}</span>
      <div className="body">
        <span className="lbl">{label}</span>
        <span className="detail">{detail}</span>
      </div>
    </div>
  );
}

function PageDetail({ page: p }: { page: SeoPage }) {
  const titlePxOk = (p.title_pixel_width ?? 0) <= 580;
  const metaPxOk = (p.meta_description_pixel_width ?? 0) <= 990;
  return (
    <div className="seo-page-detail">
      <div className="seo-detail-grid">
        <Field label="URL" value={<a href={p.url} target="_blank" rel="noopener" className="seo-link">{p.url}</a>} long />
        <Field label="Title" value={
          p.title
            ? <span>{p.title} <span className={`mono fine ${titlePxOk ? "" : "seo-warn"}`}>· {p.title_pixel_width ?? 0}px / {p.title_length} chars</span></span>
            : <em>missing</em>
        } long />
        <Field label="Meta description" value={
          p.meta_description
            ? <span>{p.meta_description} <span className={`mono fine ${metaPxOk ? "" : "seo-warn"}`}>· {p.meta_description_pixel_width ?? 0}px / {p.meta_description_length} chars</span></span>
            : <em>missing</em>
        } long />
        <Field label="H1" value={p.h1 || <em>missing</em>} long />
        {p.h2 && p.h2.length > 0 && (
          <Field label={`H2 (${p.h2_count})`} value={
            <ul className="seo-h-list">
              {p.h2.map((h, i) => <li key={i}>{h}</li>)}
              {(p.h2_count || 0) > p.h2.length && <li className="muted">…and {(p.h2_count || 0) - p.h2.length} more</li>}
            </ul>
          } long />
        )}
        <Field label="Canonical" value={p.canonical
          ? <span>{p.canonical} {p.canonical_is_self ? <span style={{ color: "var(--lime)" }}>· self</span> : <span style={{ color: "var(--warn)" }}>· different URL</span>}</span>
          : <em>missing</em>} long />
        <Field label="Robots meta" value={p.robots || <em>default (index, follow)</em>} />
        <Field label="HTML lang" value={p.lang || <em>missing</em>} />
        <Field label="Viewport" value={p.viewport || <em>missing</em>} />
        <Field label="Doctype" value={p.doctype || <em>missing</em>} />
        <Field label="Charset" value={p.charset || <em>missing</em>} />
        <Field label="Favicon" value={p.favicon || <em>missing</em>} />
        <Field label="Apple touch icon" value={p.apple_touch_icon || <em>missing</em>} />
        <Field label="Word count" value={`${p.word_count?.toLocaleString() ?? 0}`} />
        <Field label="Paragraphs" value={`${p.paragraph_count ?? 0}`} />
        <Field label="Avg sentence length" value={`${p.avg_sentence_length ?? 0} words`} />
        <Field label="Stop-word density" value={
          <span className={`${(p.stop_word_pct ?? 0) > 35 ? "seo-warn" : ""}`}>{p.stop_word_pct ?? 0}%</span>
        } />
        <Field label="Strong / bold tags" value={`${p.strong_bold_count ?? 0}`} />
        <Field label="Images" value={`${p.img_with_alt}/${p.img_total} have alt (${p.img_alt_pct}%)`} />
        <Field label="Internal links" value={`${p.internal_links}`} />
        <Field label="External links" value={`${p.external_links}`} />
        <Field label="Resources" value={`${p.js_files ?? 0} JS · ${p.css_files ?? 0} CSS · ${p.inline_scripts ?? 0} inline`} />
        <Field label="URL structure" value={
          <span>
            depth {p.url_depth ?? 0} · {p.url_param_count ?? 0} params
            {p.url_has_session_id && <span className="seo-warn"> · session id detected</span>}
          </span>
        } />
        <Field label="JSON-LD schemas" value={
          p.schema_types && p.schema_types.length > 0
            ? <span className="seo-tags">{p.schema_types.map((t) => <span key={t} className="seo-tag">{t}</span>)}</span>
            : <em>none</em>
        } long />
        <Field label="Open Graph" value={
          (p.og?.title || p.og?.image)
            ? <span className="mono fine">title:{p.og.title ? " ✓" : " ✗"} · image:{p.og.image ? " ✓" : " ✗"} · description:{p.og.description ? " ✓" : " ✗"} · url:{p.og.url ? " ✓" : " ✗"}</span>
            : <em>missing</em>
        } />
        <Field label="Twitter Card" value={
          p.twitter?.card
            ? <span className="mono fine">card:{p.twitter.card} · title:{p.twitter.title ? " ✓" : " ✗"} · image:{p.twitter.image ? " ✓" : " ✗"}</span>
            : <em>missing</em>
        } />
        {p.hreflangs && p.hreflangs.length > 0 && (
          <Field label={`Hreflang (${p.hreflangs.length})`} value={
            <span className="seo-tags">{p.hreflangs.map((h, i) => <span key={i} className="seo-tag">{h.lang}</span>)}</span>
          } long />
        )}
        <Field label="Server" value={p.server || <em>not exposed</em>} />
        <Field label="Compression" value={p.compression
          ? <span className="seo-tag">{p.compression}</span>
          : <em>none</em>} />
        <Field label="X-Powered-By" value={p.x_powered_by || <em>not exposed</em>} />
        <Field label="Last-Modified" value={p.last_modified || <em>not set</em>} />
        <Field label="Response" value={`${p.status || "—"} · ${fmtMs(p.response_ms)} · ${fmtKB(p.byte_size)}${p.redirected ? " · redirected" : ""}`} />
        {p.keywords && p.keywords.length > 0 && (
          <Field label="Top keywords on this page" value={
            <span className="seo-tags">
              {p.keywords.slice(0, 8).map((k) => (
                <span key={k.term} className="seo-tag" title={`${k.count} occurrences · ${k.density_pct}% density`}>
                  {k.term} <span style={{ color: "var(--ink-4)" }}>· {k.count}</span>
                </span>
              ))}
            </span>
          } long />
        )}
      </div>
    </div>
  );
}

// ---- Search preview card (desktop + mobile SERP mocks) ----

function SearchPreviewCard({ preview }: { preview: SeoSearchPreview }) {
  const titleStyle = preview.title_truncated ? { color: "var(--warn)" } : undefined;
  const descStyle = preview.description_truncated ? { color: "var(--warn)" } : undefined;
  const truncTitle = preview.title_truncated ? preview.title.slice(0, 60) + "…" : preview.title;
  const truncDesc = preview.description_truncated ? preview.description.slice(0, 150) + "…" : preview.description;
  return (
    <div className="seo-block">
      <h2 className="seo-block-h">search preview <span className="seo-block-count">(how it looks in Google)</span></h2>
      <div className="seo-serp-row">
        <div className="seo-serp">
          <div className="serp-label">desktop · google.com</div>
          <div className="serp-card">
            <div className="serp-meta">
              <span className="serp-fav">●</span>
              <span className="serp-site">
                <strong>{preview.host}</strong>
                <span className="serp-crumb">{preview.url}</span>
              </span>
            </div>
            <a className="serp-title" style={titleStyle}>{truncTitle}</a>
            <p className="serp-desc" style={descStyle}>
              {truncDesc || <em style={{ color: "var(--ink-4)" }}>no meta description — Google will pick something from the page text</em>}
            </p>
          </div>
          <div className="serp-pixel-bar">
            <PixelBar label="title" value={preview.title_pixel_width} max={580} />
            <PixelBar label="meta" value={preview.description_pixel_width} max={990} />
          </div>
        </div>

        <div className="seo-serp mobile">
          <div className="serp-label">mobile · google.com</div>
          <div className="serp-card serp-mobile">
            <div className="serp-meta">
              <span className="serp-fav">●</span>
              <span className="serp-site"><strong>{preview.host}</strong></span>
            </div>
            <a className="serp-title" style={titleStyle}>{truncTitle}</a>
            <p className="serp-desc" style={descStyle}>
              {truncDesc || <em style={{ color: "var(--ink-4)" }}>no meta description</em>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PixelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const over = value > max;
  return (
    <div className="seo-pixel-bar">
      <div className="head">
        <span className="lbl">{label}</span>
        <span className={`val ${over ? "warn" : ""}`}>
          {value}px <span style={{ color: "var(--ink-4)" }}>/ {max}px max</span>
        </span>
      </div>
      <div className="track">
        <span style={{ width: `${pct}%`, background: over ? "var(--red)" : "var(--lime)" }} />
        <span className="marker" />
      </div>
    </div>
  );
}

// ---- Content stats card ----

function ContentStatsCard({ stats }: { stats: SeoContentStats }) {
  return (
    <div className="seo-block">
      <h2 className="seo-block-h">content stats <span className="seo-block-count">(site averages)</span></h2>
      <div className="seo-stat-grid">
        <StatRow label="avg word count" value={stats.avg_word_count.toLocaleString()} hint="800+ recommended" ok={stats.avg_word_count >= 600} />
        <StatRow label="avg paragraphs" value={stats.avg_paragraph_count} hint="3+ recommended" ok={stats.avg_paragraph_count >= 3} />
        <StatRow label="avg sentence length" value={`${stats.avg_sentence_length} words`} hint="10-25 ideal" ok={stats.avg_sentence_length >= 10 && stats.avg_sentence_length <= 25} />
        <StatRow label="stop-word density" value={`${stats.avg_stop_word_pct}%`} hint="<35% ideal" ok={stats.avg_stop_word_pct < 35} />
        <StatRow label="avg TTFB" value={`${stats.avg_response_ms}ms`} hint="<800ms ideal" ok={stats.avg_response_ms < 800} />
        <StatRow label="avg page size" value={fmtKB(stats.avg_byte_size)} hint="<1.5MB ideal" ok={stats.avg_byte_size < 1_500_000} />
        <StatRow label="avg internal links" value={stats.avg_internal_links} hint="20+ healthy" ok={stats.avg_internal_links >= 10} />
        <StatRow label="schemas found" value={stats.total_schemas_found} hint={stats.unique_schema_types.length ? stats.unique_schema_types.slice(0, 4).join(", ") : "none"} ok={stats.total_schemas_found > 0} />
      </div>
    </div>
  );
}

function StatRow({ label, value, hint, ok }: { label: string; value: React.ReactNode; hint?: string; ok?: boolean }) {
  return (
    <div className={`seo-stat-row ${ok === false ? "fail" : ok === true ? "ok" : ""}`}>
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

// ---- Top keywords card ----

function KeywordsCard({ keywords }: { keywords: SeoKeyword[] }) {
  const max = Math.max(...keywords.map((k) => k.count), 1);
  return (
    <div className="seo-block">
      <h2 className="seo-block-h">top keywords <span className="seo-block-count">(homepage)</span></h2>
      <ul className="seo-keywords">
        {keywords.map((k) => (
          <li key={k.term}>
            <div className="kw-head">
              <span className="term">{k.term}</span>
              <span className="num">{k.count} <span style={{ color: "var(--ink-4)" }}>· {k.density_pct}%</span></span>
            </div>
            <div className="kw-bar">
              <span style={{ width: `${(k.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value, long }: { label: string; value: React.ReactNode; long?: boolean }) {
  return (
    <div className={`seo-field${long ? " long" : ""}`}>
      <span className="seo-field-label">{label}</span>
      <span className="seo-field-value">{value}</span>
    </div>
  );
}
