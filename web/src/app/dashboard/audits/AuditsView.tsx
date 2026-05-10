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
  const initialType = (searchParams.get("type") as AuditType) || "cro";
  const runUrl = searchParams.get("run");

  const [active, setActive] = useState<AuditType>(
    TABS.some((t) => t.id === initialType) ? initialType : "cro",
  );
  const [items, setItems] = useState<Audit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Single-shot auto-run when arriving with ?run= from another page.
  const autoRun = useRef<string | null>(runUrl);

  const refresh = useCallback(async (t: AuditType) => {
    try {
      const r = await audits.list(t);
      const list = Array.isArray(r) ? r : r.results;
      setItems(list);
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not load (${e.status})`);
    }
  }, []);

  useEffect(() => {
    refresh(active);
  }, [active, refresh]);

  // Auto-run from ?run=&type=
  useEffect(() => {
    const url = autoRun.current;
    if (!url) return;
    autoRun.current = null;
    (async () => {
      setBusy(true);
      try {
        await audits.run(url, active);
        router.replace(`/dashboard/audits?type=${active}`);
        await refresh(active);
      } catch {
        setErr("could not run that audit");
      } finally {
        setBusy(false);
      }
    })();
  }, [active, refresh, router]);

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
        <div style={{ padding: "14px 16px", background: "var(--lime-soft)", borderLeft: "2px solid var(--lime)", marginBottom: 18, fontFamily: "var(--mono)", fontSize: 12, color: "var(--lime)" }}>
          ● running {active.toUpperCase()} audit…
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
          {items.map((a) => (
            <div key={a.id} style={{ padding: "20px 22px", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/dashboard/audits/${a.id}`} className="mono" style={{ fontSize: 14, color: "var(--ink)" }}>
                    {a.url} <span style={{ color: "var(--ink-4)" }}>↗</span>
                  </Link>
                  <div className="mono fine" style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span style={{
                      color: a.status === "done" ? "var(--lime)" : a.status === "failed" ? "var(--red)" : "var(--warn)",
                    }}>
                      ● {a.status}
                    </span>
                    <span style={{ color: "var(--ink-5)" }}>·</span>
                    <span>{a.audit_type.toUpperCase()}</span>
                    <span style={{ color: "var(--ink-5)" }}>·</span>
                    <span>{(a.elapsed_ms / 1000).toFixed(1)}s</span>
                    <span style={{ color: "var(--ink-5)" }}>·</span>
                    <span>
                      {a.findings.length > 0
                        ? `${a.findings.length} finding${a.findings.length === 1 ? "" : "s"}`
                        : `${(a.report?.sections?.length ?? 0) + (a.report?.areas?.length ?? 0)} sections`}
                    </span>
                    <span style={{ color: "var(--ink-5)" }}>·</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <Link href={`/dashboard/audits/${a.id}`} className="icon-btn">
                  open report
                </Link>
              </div>

              {a.summary && (
                <p className="mono" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 12, lineHeight: 1.6 }}>
                  {a.summary}
                </p>
              )}
            </div>
          ))}
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
