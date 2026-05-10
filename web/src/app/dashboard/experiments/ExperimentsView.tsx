"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, experiments, type Experiment } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  trial: "var(--warn)",
  winner: "var(--lime)",
  killed: "var(--red)",
  paused: "var(--ink-3)",
  draft: "var(--ink-3)",
};

export default function ExperimentsView() {
  const [items, setItems] = useState<Experiment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    experiments.list()
      .then((r) => setItems(Array.isArray(r) ? r : r.results))
      .catch((e) => {
        if (e instanceof ApiError) setErr(`could not load (${e.status})`);
      });
  }, []);

  if (err) return <div className="form-error">{err}</div>;
  if (items === null) return <p className="fine">loading…</p>;

  if (items.length === 0) {
    return (
      <div className="empty-card">
        <h3>no experiments yet</h3>
        <p style={{ marginBottom: 18 }}>
          ~ register a site, then bandit will draft your first variants within minutes.
        </p>
        <Link href="/dashboard/sites" className="btn btn-lime">register a site →</Link>
      </div>
    );
  }

  return (
    <div className="list-card">
      {items.map((x) => (
        <div key={x.id} className="list-row">
          <div>
            <div className="primary">{x.name}</div>
            <div className="meta">
              <span style={{ color: STATUS_COLORS[x.status] }}>● {x.status}</span>
              <span className="dot">·</span>
              <span>{x.site_domain}</span>
              <span className="dot">·</span>
              <span>{x.surface}</span>
              <span className="dot">·</span>
              <span>{x.variants.length} variant{x.variants.length === 1 ? "" : "s"}</span>
              {x.uplift_pct !== 0 && (
                <>
                  <span className="dot">·</span>
                  <span style={{ color: x.uplift_pct > 0 ? "var(--lime)" : "var(--red)" }}>
                    {x.uplift_pct > 0 ? "+" : ""}{x.uplift_pct.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="actions">
            <Link href={`/dashboard/experiments/${x.id}`} className="icon-btn">open ↗</Link>
          </div>
        </div>
      ))}
    </div>
  );
}
