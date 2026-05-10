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

export default function ExperimentDetailView({ id }: { id: number }) {
  const [exp, setExp] = useState<Experiment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const e = await experiments.get(id);
      setExp(e);
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not load (${e.status})`);
    }
  }

  useEffect(() => {
    refresh();
    // Polling — picks up allocator weight changes without a reload
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(action: "approve" | "kill" | "pause") {
    setBusy(action);
    setErr(null);
    try {
      if (action === "approve") await experiments.approve(id);
      else if (action === "kill") await experiments.kill(id);
      else await experiments.pause(id);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not ${action} (${e.status})`);
    } finally {
      setBusy(null);
    }
  }

  if (err) return <div className="form-error">{err}</div>;
  if (!exp) return <p className="fine">loading…</p>;

  // Sort: control first, then by weight desc
  const variants = [...exp.variants].sort((a, b) => {
    if (a.is_control && !b.is_control) return -1;
    if (b.is_control && !a.is_control) return 1;
    return b.weight - a.weight;
  });

  const totalSamples = variants.reduce((s, v) => s + v.samples, 0);
  const totalConv = variants.reduce((s, v) => s + v.conversions, 0);
  const overallRate = totalSamples ? (totalConv / totalSamples) * 100 : 0;

  return (
    <>
      <div className="dash-header">
        <div>
          <h1><em>experiment</em> · {exp.name}</h1>
          <p className="sub">
            ~ {exp.site_domain} · {exp.surface} ·{" "}
            <span style={{ color: STATUS_COLORS[exp.status] }}>● {exp.status}</span>
            {exp.confidence > 0 && (
              <> · confidence <span style={{ color: "var(--lime)" }}>{(exp.confidence * 100).toFixed(1)}%</span></>
            )}
            {exp.uplift_pct !== 0 && (
              <> · uplift <span style={{ color: exp.uplift_pct > 0 ? "var(--lime)" : "var(--red)" }}>
                {exp.uplift_pct > 0 ? "+" : ""}{exp.uplift_pct.toFixed(1)}%
              </span></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {exp.status === "draft" && (
            <button className="btn btn-lime" disabled={busy !== null} onClick={() => act("approve")}>
              {busy === "approve" ? "approving…" : "approve → trial ↗"}
            </button>
          )}
          {exp.status === "paused" && (
            <button className="btn btn-lime" disabled={busy !== null} onClick={() => act("approve")}>
              {busy === "approve" ? "resuming…" : "resume ↗"}
            </button>
          )}
          {exp.status === "trial" && (
            <button className="icon-btn" disabled={busy !== null} onClick={() => act("pause")}>
              {busy === "pause" ? "pausing…" : "pause"}
            </button>
          )}
          {(exp.status === "trial" || exp.status === "paused") && (
            <button className="icon-btn danger" disabled={busy !== null} onClick={() => act("kill")}>
              {busy === "kill" ? "killing…" : "kill"}
            </button>
          )}
          <Link href="/dashboard/experiments" className="icon-btn">← back</Link>
        </div>
      </div>

      {exp.hypothesis && (
        <div style={{ padding: "16px 18px", background: "var(--bg-1)", borderLeft: "2px solid var(--ink-4)", marginBottom: 24, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.65, borderRadius: "0 4px 4px 0" }}>
          <strong style={{ color: "var(--lime)", display: "block", marginBottom: 6, fontSize: 11, letterSpacing: "0.06em" }}>HYPOTHESIS</strong>
          {exp.hypothesis}
        </div>
      )}

      {/* Overall stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          ["samples", totalSamples.toLocaleString()],
          ["conversions", totalConv.toLocaleString()],
          ["rate", `${overallRate.toFixed(2)}%`],
          ["variants", String(variants.length)],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
            <div className="mono fine" style={{ marginBottom: 6 }}>{k}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>

      <h2 className="mono fine" style={{ margin: "0 0 14px", color: "var(--ink-3)" }}>variants</h2>

      <div className="list-card">
        {variants.map((v) => {
          const rate = v.samples ? (v.conversions / v.samples) * 100 : 0;
          const widthPct = Math.max(2, v.weight * 100);
          return (
            <div key={v.id} style={{ padding: "18px 22px", borderBottom: "1px solid var(--hairline)", position: "relative" }}>
              {/* Weight bar (background) */}
              <div style={{
                position: "absolute", inset: 0,
                width: `${widthPct}%`,
                background: v.is_control ? "rgba(120,120,120,0.05)" : "var(--lime-soft)",
                pointerEvents: "none",
              }} />
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 20, alignItems: "center" }}>
                <div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                    {v.name}
                    {v.is_control && (
                      <span className="mono" style={{ marginLeft: 10, fontSize: 10, padding: "2px 6px", border: "1px solid var(--hairline-strong)", borderRadius: 999, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
                        CONTROL
                      </span>
                    )}
                  </div>
                  {v.body && !v.is_control && (
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>
                      &ldquo;{v.body.length > 120 ? v.body.slice(0, 120) + "…" : v.body}&rdquo;
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono fine">samples</div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--ink)" }}>{v.samples.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono fine">conv</div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--ink)" }}>{v.conversions.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono fine">rate</div>
                  <div className="mono" style={{ fontSize: 14, color: rate > 0 ? "var(--lime)" : "var(--ink-3)", fontWeight: 600 }}>
                    {rate.toFixed(2)}%
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div className="mono fine">traffic</div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
                    {(v.weight * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mono fine" style={{ marginTop: 18, color: "var(--ink-4)" }}>
        ~ traffic weights re-allocated by the bandit allocator (Thompson sampling).
        run <code>python manage.py allocate_bandits</code> to update now.
      </p>
    </>
  );
}
