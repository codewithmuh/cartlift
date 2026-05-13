"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, publicAudits, type Audit, type AuditBundle, type AuditType } from "@/lib/api";

const TAB_ORDER: AuditType[] = ["cro", "seo", "compliance", "gmc"];
const TAB_LABEL: Record<AuditType, string> = {
  cro: "conversion",
  seo: "seo",
  compliance: "trust & policy",
  gmc: "google merchant",
};

type Props = { bundle: AuditBundle; claimHref: string };

export default function BundleView({ bundle, claimHref }: Props) {
  // Default to the first tab that actually has data — keeps backfilled
  // single-type bundles (old /audit/<slug> links) from landing on an empty tab.
  const firstWithData =
    TAB_ORDER.find((t) => (bundle.audits[t]?.findings?.length ?? 0) > 0 || hasReport(bundle.audits[t])) ?? "cro";

  const [active, setActive] = useState<AuditType>(firstWithData);
  const [pdfOpen, setPdfOpen] = useState(false);

  const current = bundle.audits[active];

  return (
    <>
      <div className="audit-tabs" role="tablist" aria-label="audit reports">
        <div className="audit-tabs-list">
          {TAB_ORDER.map((t) => {
            const a = bundle.audits[t];
            const findings = a?.findings?.length ?? 0;
            const disabled = !a;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active === t}
                aria-controls={`tab-${t}`}
                disabled={disabled}
                className={`audit-tab${active === t ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
                onClick={() => setActive(t)}
              >
                <span className="audit-tab-name">{TAB_LABEL[t]}</span>
                {a && (
                  <span className="audit-tab-count">
                    {findings > 0 ? `${findings}` : a.status === "done" ? "report" : a.status}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="audit-tabs-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPdfOpen(true)}
            aria-haspopup="dialog"
          >
            ⤓ download pdf
          </button>
          <Link href={claimHref} className="btn btn-lime">
            create free account →
          </Link>
        </div>
      </div>

      {TAB_ORDER.map((t) => {
        const a = bundle.audits[t];
        if (!a) return null;
        return (
          <section
            key={t}
            id={`tab-${t}`}
            role="tabpanel"
            aria-labelledby={`tab-btn-${t}`}
            hidden={active !== t}
            data-audit-type={t}
            className="audit-tab-panel"
          >
            <TabContent audit={a} kind={t} />
          </section>
        );
      })}

      {pdfOpen && current && (
        <PdfEmailModal
          groupSlug={bundle.group_slug}
          activeType={active}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </>
  );
}

function hasReport(a?: Audit): boolean {
  if (!a?.report) return false;
  const r = a.report;
  return Boolean(
    r.checks?.length || r.sections?.length || r.areas?.length || r.scores || r.opportunities?.length,
  );
}

/* ============================================================
   Tab content — switches on audit kind
   ============================================================ */

function TabContent({ audit, kind }: { audit: Audit; kind: AuditType }) {
  if (audit.status === "failed") {
    return (
      <div className="audit-pub-empty">
        <strong>this audit didn&apos;t finish.</strong> {audit.error || "the page blocked our fetcher or the LLM call failed."}
      </div>
    );
  }
  return (
    <>
      {audit.summary && <p className="audit-pub-summary">{audit.summary}</p>}
      {kind === "seo" && audit.report?.scores && <SeoScoresCard scores={audit.report.scores} />}
      {kind === "gmc" && audit.report?.conclusion && <ConclusionCard items={audit.report.conclusion} />}
      {kind === "compliance" && audit.report?.conclusion && <ConclusionCard items={audit.report.conclusion} />}

      {(audit.findings?.length ?? 0) > 0 && <FindingsList findings={audit.findings} />}

      {audit.report?.areas && audit.report.areas.length > 0 && (
        <SectionsList title="risk areas" items={audit.report.areas} />
      )}
      {audit.report?.sections && audit.report.sections.length > 0 && (
        <SectionsList title="review details" items={audit.report.sections} />
      )}
      {audit.report?.checks && audit.report.checks.length > 0 && (
        <ChecksList items={audit.report.checks} />
      )}

      {(audit.findings?.length ?? 0) === 0 && !hasReport(audit) && (
        <div className="audit-pub-empty">
          <strong>no findings on this lens.</strong> looks clean — or the page blocked deep inspection.
        </div>
      )}
    </>
  );
}

function FindingsList({ findings }: { findings: Audit["findings"] }) {
  return (
    <ol className="audit-pub-findings">
      {findings.map((f, i) => (
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
    </ol>
  );
}

function ChecksList({ items }: { items: NonNullable<Audit["report"]["checks"]> }) {
  return (
    <div className="audit-pub-checks">
      <h4 className="audit-pub-section-title">checks</h4>
      <ul>
        {items.map((c, i) => (
          <li key={i} className={c.ok ? "ok" : "fail"}>
            <span className="check-icon" aria-hidden>{c.ok ? "✓" : "✗"}</span>
            <span className="check-item">{c.item}</span>
            {c.note && <span className="check-note">{c.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionsList({
  title,
  items,
}: {
  title: string;
  items: NonNullable<Audit["report"]["sections"]>;
}) {
  return (
    <div className="audit-pub-sections">
      <h4 className="audit-pub-section-title">{title}</h4>
      {items.map((s, i) => (
        <div key={i} className="audit-pub-section">
          <h5>{s.title}</h5>
          <p>{s.finding}</p>
          {s.recommendations && s.recommendations.length > 0 && (
            <ul className="audit-pub-recs">
              {s.recommendations.map((r, j) => (
                <li key={j}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ConclusionCard({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="audit-pub-conclusion">
      <h4 className="audit-pub-section-title">do this week</h4>
      <ol>
        {items.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ol>
    </div>
  );
}

function SeoScoresCard({ scores }: { scores: NonNullable<Audit["report"]["scores"]> }) {
  const grade =
    scores.overall >= 90 ? "A" :
    scores.overall >= 75 ? "B" :
    scores.overall >= 60 ? "C" :
    scores.overall >= 40 ? "D" : "F";
  return (
    <div className="audit-pub-seo-scores">
      <div className="seo-score-grade">
        <span className="grade-letter">{grade}</span>
        <span className="grade-num">{scores.overall}<small>/100</small></span>
      </div>
      <div className="seo-score-axes">
        <div><span>technical</span><strong>{scores.technical ?? 0}</strong></div>
        <div><span>content</span><strong>{scores.content ?? 0}</strong></div>
        <div><span>structured data</span><strong>{scores.structured_data ?? 0}</strong></div>
        <div><span>performance</span><strong>{scores.performance ?? 0}</strong></div>
      </div>
    </div>
  );
}

/* ============================================================
   PDF email gate modal — captures lead, then triggers window.print()
   ============================================================ */

function PdfEmailModal({
  groupSlug,
  activeType,
  onClose,
}: {
  groupSlug: string;
  activeType: AuditType;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Close on Escape, lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setErr(null);
    try {
      await publicAudits.requestPdf(groupSlug, value);
      onClose();
      // Give the modal a tick to unmount before print() captures the DOM.
      setTimeout(() => window.print(), 80);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setErr("that email doesn't look right. try again.");
      } else {
        setErr("couldn't queue your PDF. try again in a moment.");
      }
      setBusy(false);
    }
  }

  return (
    <div
      className="pdf-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
      onClick={onClose}
    >
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="pdf-modal-close"
          aria-label="close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="eyebrow">download · pdf</div>
        <h2 id="pdf-modal-title">Where should we send the PDF?</h2>
        <p>
          Free PDF of the <strong>{TAB_LABEL[activeType]}</strong> report. Drop your
          email and we&apos;ll open the print view straight away — same data, optimized
          for print + sharing with your team.
        </p>
        <form onSubmit={onSubmit} className={`unlock-form${busy ? " is-busy" : ""}`} aria-busy={busy}>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@your-store.com"
            autoComplete="email"
            spellCheck={false}
            disabled={busy}
            aria-label="email"
          />
          <button type="submit" className="btn btn-lime" disabled={busy || !email.trim()}>
            {busy ? "preparing…" : "email + open pdf →"}
          </button>
        </form>
        {err && <div className="unlock-form-error mono" role="alert">! {err}</div>}
        <p className="unlock-form-fine mono">
          we email captured leads occasionally · unsubscribe anytime
        </p>
      </div>
    </div>
  );
}
