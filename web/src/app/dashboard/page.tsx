"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  audits as auditsApi,
  experiments as experimentsApi,
  sites as sitesApi,
  type Audit,
  type Experiment,
  type Site,
} from "@/lib/api";

const TYPE_LABEL: Record<string, string> = {
  cro: "cro", seo: "seo", compliance: "compliance", gmc: "gmc",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function unwrap<T>(r: { results: T[] } | T[]): T[] {
  return Array.isArray(r) ? r : r.results;
}

export default function DashboardHome() {
  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);

  useEffect(() => {
    auditsApi.list().then((r) => setAudits(unwrap(r))).catch(() => setAudits([]));
    sitesApi.list().then((r) => setSites(unwrap(r))).catch(() => setSites([]));
    experimentsApi.list().then((r) => setExperiments(unwrap(r))).catch(() => setExperiments([]));
  }, []);

  const loaded = audits !== null && sites !== null && experiments !== null;
  const auditCount = audits?.length ?? 0;
  const siteCount = sites?.length ?? 0;
  const expActive = experiments?.filter((e) => e.status === "trial").length ?? 0;
  const winners = experiments?.filter((e) => e.status === "winner").length ?? 0;
  const totalUplift = (audits ?? [])
    .flatMap((a) => a.findings || [])
    .reduce((sum, f) => sum + (f.predicted_lift_pct || 0), 0);

  const recent = (audits ?? []).slice(0, 5);

  return (
    <>
      <div className="dash-header">
        <div>
          <h1>welcome to <em>bandit.</em></h1>
          <p className="sub">~ {loaded
            ? `${auditCount} audits · ${siteCount} sites · ${expActive} live · ${winners} winners shipped`
            : "loading workspace…"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard/audits" className="btn btn-lime" style={{ padding: "10px 16px" }}>
            + new audit
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatTile label="audits run" value={auditCount} loaded={loaded} hint="across all types" />
        <StatTile label="sites registered" value={siteCount} loaded={loaded} hint="with active snippet" />
        <StatTile label="experiments live" value={expActive} loaded={loaded} accent hint="bandit is allocating" />
        <StatTile
          label="predicted uplift"
          value={loaded ? `+${totalUplift.toFixed(1)}%` : "…"}
          loaded={loaded}
          accent
          hint="sum across all findings"
        />
      </div>

      <div className="dash-row">
        <section className="dash-panel">
          <div className="panel-head">
            <h2>recent audits</h2>
            <Link href="/dashboard/audits" className="icon-btn">see all →</Link>
          </div>
          {!loaded && <p className="panel-empty">loading…</p>}
          {loaded && recent.length === 0 && (
            <div className="panel-empty">
              <p>no audits yet.</p>
              <Link href="/dashboard/audits" className="btn btn-lime" style={{ marginTop: 14, padding: "10px 16px" }}>
                run your first audit
              </Link>
            </div>
          )}
          {loaded && recent.length > 0 && (
            <ul className="activity-feed">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/dashboard/audits/${a.id}`} className="activity-row">
                    <span className={`tag tag-${a.audit_type}`}>{TYPE_LABEL[a.audit_type] ?? a.audit_type}</span>
                    <div className="activity-body">
                      <span className="activity-url">{a.url}</span>
                      <span className="activity-meta">
                        {a.status}
                        <span className="dot">·</span>
                        {(a.elapsed_ms / 1000).toFixed(1)}s
                        <span className="dot">·</span>
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                    <span className="activity-arrow">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-panel">
          <div className="panel-head">
            <h2>quick actions</h2>
          </div>
          <div className="action-grid">
            <Link href="/dashboard/audits" className="action-card">
              <span className="action-num">01</span>
              <h3>run an audit</h3>
              <p>paste any url. get annotated findings in &lt;30s.</p>
              <span className="action-arrow">→</span>
            </Link>
            <Link href="/dashboard/sites" className="action-card">
              <span className="action-num">02</span>
              <h3>register a site</h3>
              <p>install the snippet. start collecting samples.</p>
              <span className="action-arrow">→</span>
            </Link>
            <Link href="/dashboard/experiments" className="action-card">
              <span className="action-num">03</span>
              <h3>review experiments</h3>
              <p>approve, kill, or let the bandit decide.</p>
              <span className="action-arrow">→</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function StatTile({
  label, value, hint, accent, loaded,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  loaded: boolean;
}) {
  return (
    <div className={`stat-tile${accent ? " accent" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{loaded ? value : "…"}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
