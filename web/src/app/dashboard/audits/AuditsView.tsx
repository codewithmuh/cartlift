"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, audits, type Audit, type AuditType } from "@/lib/api";

const TABS: { id: AuditType; name: string; tag: string }[] = [
  { id: "cro", name: "conversion", tag: "CRO" },
  { id: "seo", name: "seo", tag: "SEO" },
  { id: "compliance", name: "compliance", tag: "TRUST" },
  { id: "gmc", name: "google merchant", tag: "GMC" },
];

function AuditsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlType = (searchParams.get("type") as AuditType) || "cro";
  const runUrl = searchParams.get("run");

  const [active, setActive] = useState<AuditType>(
    TABS.some((t) => t.id === urlType) ? urlType : "cro",
  );
  const [items, setItems] = useState<Audit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Dedup key for the auto-run useEffect — re-fires per (url, type) but never
  // for the same pair twice. Prevents both double-runs on re-render and
  // missed-runs when navigating from AuditBar with the component already mounted.
  const lastRun = useRef<string | null>(null);

  const refresh = useCallback(async (t: AuditType) => {
    try {
      const r = await audits.list(t);
      const list = Array.isArray(r) ? r : r.results;
      setItems(list);
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not load (${e.status})`);
    }
  }, []);

  // Sync local `active` tab state when the URL ?type= changes (e.g. submitted
  // from AuditBar while we're already on this page).
  useEffect(() => {
    if (TABS.some((t) => t.id === urlType) && urlType !== active) {
      setActive(urlType);
    }
  }, [urlType, active]);

  useEffect(() => {
    refresh(active);
  }, [active, refresh]);

  // Auto-run from ?run=&type=. Watches the actual searchParam so submissions
  // from inside the dashboard (AuditBar router.push) fire too.
  useEffect(() => {
    if (!runUrl) return;
    const key = `${runUrl}::${urlType}`;
    if (lastRun.current === key) return;
    lastRun.current = key;
    (async () => {
      setBusy(true);
      setErr(null);
      try {
        await audits.run(runUrl, urlType);
        router.replace(`/dashboard/audits?type=${urlType}`);
        await refresh(urlType);
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          setErr("rate limit hit. wait an hour or self-host to skip the cap.");
        } else {
          setErr("could not run that audit. check the url and try again.");
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [runUrl, urlType, refresh, router]);

  return (
    <>
      <div className="dash-header">
        <div>
          <h1>your <em>audits.</em></h1>
          <p className="sub">~ run cro · seo · compliance · gmc audits on any url. paste in the bar above.</p>
        </div>
      </div>

      <div className="audit-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`audit-tab ${active === t.id ? "active" : ""}`}
            onClick={() => {
              setActive(t.id);
              router.replace(`/dashboard/audits?type=${t.id}`);
            }}
          >
            {t.name}
            <span className="tag">{t.tag}</span>
          </button>
        ))}
      </div>

      {err && <div className="form-error">{err}</div>}
      {busy && (
        <div className="audit-running-banner">
          running {active.toUpperCase()} audit…
        </div>
      )}

      {items === null ? (
        <p className="fine">loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-card">
          <h3>no {active} audits yet</h3>
          <p>~ paste a url in the audit bar at the top to run your first {active.toUpperCase()} audit.</p>
        </div>
      ) : (
        <div className="list-card">
          {items.map((a) => {
            const count = a.findings.length > 0
              ? `${a.findings.length} finding${a.findings.length === 1 ? "" : "s"}`
              : `${(a.report?.sections?.length ?? 0) + (a.report?.areas?.length ?? 0)} sections`;
            return (
              <div key={a.id} className="audit-row">
                <div className="audit-row-body">
                  <div className="audit-row-top">
                    <span className={`status-chip ${a.status}`}>{a.status}</span>
                    <span className="type-chip">{a.audit_type.toUpperCase()}</span>
                  </div>
                  <Link href={`/dashboard/audits/${a.id}`} className="audit-url">
                    {a.url}<span className="ext">↗</span>
                  </Link>
                  <div className="audit-meta">
                    <span>{count}</span>
                    <span className="sep">·</span>
                    <span>{(a.elapsed_ms / 1000).toFixed(1)}s</span>
                    <span className="sep">·</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.summary && <p className="audit-summary">{a.summary}</p>}
                </div>
                <Link href={`/dashboard/audits/${a.id}`} className="open-report-btn">
                  open report
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AuditsView() {
  return (
    <Suspense>
      <AuditsInner />
    </Suspense>
  );
}
