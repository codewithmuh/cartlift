"use client";

import { useEffect, useState } from "react";
import { ApiError, experiments, type WeightHistory } from "@/lib/api";

// Distinct stroke colors for non-control variants. Control is always neutral.
// Keep these in sync with globals.css tokens — no new colors introduced.
const VARIANT_STROKES = [
  "var(--lime)",
  "var(--warn)",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

const W = 720;
const H = 220;
const PAD_L = 44;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 28;

function fmtTick(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function WeightHistoryChart({ experimentId }: { experimentId: number }) {
  const [data, setData] = useState<WeightHistory | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const h = await experiments.weightHistory(experimentId);
        if (!cancelled) setData(h);
      } catch (e) {
        if (!cancelled && e instanceof ApiError) setErr(`could not load history (${e.status})`);
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [experimentId]);

  if (err) return <div className="form-error">{err}</div>;
  if (!data) {
    return (
      <div style={{ padding: "24px 22px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
        <p className="mono fine">loading weight history…</p>
      </div>
    );
  }

  const { snapshots } = data;

  if (snapshots.length === 0) {
    return (
      <div style={{ padding: "24px 22px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
        <div className="mono fine" style={{ marginBottom: 6 }}>weight history</div>
        <p className="mono fine" style={{ color: "var(--ink-4)" }}>
          no allocator ticks yet — the scheduler writes a snapshot every time it
          re-weights this experiment.
        </p>
      </div>
    );
  }

  // Build per-variant time series from the snapshot arms.
  const variantOrder: { id: number; name: string; is_control: boolean }[] = [];
  const seen = new Set<number>();
  for (const s of snapshots) {
    for (const a of s.arms) {
      if (!seen.has(a.variant_id)) {
        seen.add(a.variant_id);
        variantOrder.push({ id: a.variant_id, name: a.name, is_control: a.is_control });
      }
    }
  }
  // Control first, then by first-appearance order
  variantOrder.sort((a, b) => Number(b.is_control) - Number(a.is_control));

  const n = snapshots.length;
  const stepX = n > 1 ? (W - PAD_L - PAD_R) / (n - 1) : 0;
  const yFor = (w: number) => PAD_T + (1 - w) * (H - PAD_T - PAD_B);
  const xFor = (i: number) => PAD_L + i * stepX;

  const series = variantOrder.map((v, idx) => {
    const points: [number, number][] = snapshots.map((s, i) => {
      const arm = s.arms.find((a) => a.variant_id === v.id);
      return [xFor(i), yFor(arm ? arm.weight : 0)];
    });
    const path = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const stroke = v.is_control ? "var(--ink-3)" : VARIANT_STROKES[idx % VARIANT_STROKES.length];
    return { variant: v, path, stroke };
  });

  // Gridlines at 0, 25, 50, 75, 100%
  const gridY = [0, 0.25, 0.5, 0.75, 1.0];

  // Sparse x-axis ticks — first, middle, last (avoids label collision)
  const tickIndices = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor(n / 2), n - 1];

  const last = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const spanLabel = first && last
    ? `${new Date(first.created_at).toLocaleString()} → ${new Date(last.created_at).toLocaleString()}`
    : "";

  return (
    <div style={{ padding: "20px 22px 18px", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="mono fine">weight history · {snapshots.length} tick{snapshots.length === 1 ? "" : "s"}</div>
        <div className="mono fine" style={{ color: "var(--ink-4)" }}>{spanLabel}</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }} aria-label="variant weight history">
        {gridY.map((g) => {
          const y = yFor(g);
          return (
            <g key={g}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--hairline)" strokeWidth={1} />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--ink-4)">
                {Math.round(g * 100)}%
              </text>
            </g>
          );
        })}

        {tickIndices.map((i) => (
          <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill="var(--ink-4)">
            {fmtTick(snapshots[i].created_at)}
          </text>
        ))}

        {series.map(({ variant, path, stroke }) => (
          <path
            key={variant.id}
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={variant.is_control ? 1.5 : 2}
            strokeDasharray={variant.is_control ? "4 3" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* End-of-series dots — visual anchor on the latest tick */}
        {series.map(({ variant, stroke }) => {
          const arm = last.arms.find((a) => a.variant_id === variant.id);
          if (!arm) return null;
          return (
            <circle
              key={`d-${variant.id}`}
              cx={xFor(n - 1)}
              cy={yFor(arm.weight)}
              r={3}
              fill={stroke}
            />
          );
        })}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 10 }}>
        {series.map(({ variant, stroke }) => {
          const arm = last.arms.find((a) => a.variant_id === variant.id);
          return (
            <div key={variant.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block", width: 16, height: 2,
                background: stroke,
                borderTop: variant.is_control ? `2px dashed ${stroke}` : undefined,
              }} />
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
                {variant.name}
                {variant.is_control && <span style={{ color: "var(--ink-4)" }}> (control)</span>}
              </span>
              <span className="mono fine" style={{ color: "var(--ink-4)" }}>
                {arm ? `${(arm.weight * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
