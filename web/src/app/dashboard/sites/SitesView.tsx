"use client";

import { useEffect, useState } from "react";
import { ApiError, API_BASE, sites, type Site } from "@/lib/api";

function snippetTag(token: string): string {
  return `<script async src="${API_BASE}/s/${token}.js"></script>`;
}

function conversionTag(token: string, experimentId = "EXPERIMENT_ID"): string {
  return `<!-- on conversion (button click, form submit, …) -->\n<script>window.bandit && window.bandit.convert(${experimentId});</script>`;
}

export default function SitesView() {
  const [items, setItems] = useState<Site[] | null>(null);
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openInstallId, setOpenInstallId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await sites.list();
      const list = Array.isArray(r) ? r : r.results;
      setItems(list);
    } catch {
      setErr("could not load sites");
    }
  }

  useEffect(() => { refresh(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const created = await sites.create(domain, label, 50);
      setDomain("");
      setLabel("");
      await refresh();
      setOpenInstallId(created.id);
    } catch (e) {
      if (e instanceof ApiError && e.data && typeof e.data === "object") {
        const d = e.data as Record<string, unknown>;
        const msg = (Array.isArray(d.domain) && d.domain[0]) || (typeof d.detail === "string" && d.detail) || "could not register site";
        setErr(String(msg));
      } else {
        setErr("could not register site");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: number) {
    if (!confirm("remove this site? cartlift will stop watching immediately.")) return;
    try {
      await sites.remove(id);
      await refresh();
    } catch {
      setErr("could not remove site");
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 28, alignItems: "start" }}>
      <form onSubmit={onAdd} style={{ background: "var(--bg-1)", border: "1px solid var(--hairline)", borderRadius: 6, padding: 24 }}>
        <div className="eyebrow">register</div>
        <h2 className="mono" style={{ fontSize: 19, marginTop: 14, marginBottom: 18, color: "var(--ink)" }}>
          add a <span style={{ color: "var(--lime)" }}>site</span>
        </h2>

        {err && <div className="form-error">{err}</div>}

        <div className="field">
          <label>domain</label>
          <input type="text" required value={domain}
            placeholder="acme.com"
            onChange={(e) => setDomain(e.target.value)} />
          <span className="help">~ no scheme. just the host.</span>
        </div>

        <div className="field">
          <label>label (optional)</label>
          <input type="text" value={label}
            placeholder="production · marketing site"
            onChange={(e) => setLabel(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-lime" disabled={busy} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
          {busy ? "registering…" : "register site →"}
        </button>
      </form>

      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>your sites</div>
        {items === null ? (
          <p className="fine">loading…</p>
        ) : items.length === 0 ? (
          <div className="empty-card">
            <h3>no sites yet</h3>
            <p>~ add one on the left to get a snippet token.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((s) => {
              const tag = snippetTag(s.token);
              const conv = conversionTag(s.token);
              const isOpen = openInstallId === s.id;
              return (
                <div key={s.id} className="list-card" style={{ overflow: "hidden" }}>
                  <div className="list-row" style={{ borderBottom: isOpen ? "1px solid var(--hairline)" : "none" }}>
                    <div>
                      <div className="primary">{s.domain}</div>
                      <div className="meta">
                        <span>{s.label || "—"}</span>
                        <span className="dot">·</span>
                        <span>token <span style={{ color: "var(--ink-2)" }}>{s.token.slice(0, 14)}…</span></span>
                        <span className="dot">·</span>
                        <span>sampling {s.sampling}%</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button
                        className="icon-btn"
                        onClick={() => setOpenInstallId(isOpen ? null : s.id)}
                      >
                        {isOpen ? "hide install" : "install ↗"}
                      </button>
                      <button className="icon-btn danger" onClick={() => onRemove(s.id)}>
                        remove
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "20px 22px", background: "var(--bg-1)" }}>
                      <div className="mono fine" style={{ marginBottom: 8, color: "var(--lime)" }}>1. paste in your &lt;head&gt;</div>
                      <div style={{ display: "flex", gap: 0, alignItems: "stretch", marginBottom: 18 }}>
                        <pre style={{
                          flex: 1,
                          padding: "12px 14px",
                          background: "#0e0e0e",
                          color: "#a3e6c4",
                          fontFamily: "var(--mono)",
                          fontSize: 14,
                          borderRadius: "4px 0 0 4px",
                          margin: 0,
                          overflow: "auto",
                          lineHeight: 1.5,
                          border: "1px solid #2a2a2a",
                          borderRight: "none",
                        }}>{tag}</pre>
                        <button
                          className="icon-btn"
                          onClick={() => copy(tag, `script-${s.id}`)}
                          style={{ borderRadius: "0 4px 4px 0", padding: "0 14px", borderLeft: "none" }}
                        >
                          {copied === `script-${s.id}` ? "✓ copied" : "copy"}
                        </button>
                      </div>

                      <div className="mono fine" style={{ marginBottom: 8, color: "var(--lime)" }}>2. fire conversions</div>
                      <div style={{ display: "flex", gap: 0, alignItems: "stretch", marginBottom: 14 }}>
                        <pre style={{
                          flex: 1,
                          padding: "12px 14px",
                          background: "#0e0e0e",
                          color: "#d8d8d8",
                          fontFamily: "var(--mono)",
                          fontSize: 14,
                          borderRadius: "4px 0 0 4px",
                          margin: 0,
                          overflow: "auto",
                          lineHeight: 1.5,
                          border: "1px solid #2a2a2a",
                          borderRight: "none",
                          whiteSpace: "pre-wrap",
                        }}>{conv}</pre>
                        <button
                          className="icon-btn"
                          onClick={() => copy(conv, `conv-${s.id}`)}
                          style={{ borderRadius: "0 4px 4px 0", padding: "0 14px", borderLeft: "none" }}
                        >
                          {copied === `conv-${s.id}` ? "✓ copied" : "copy"}
                        </button>
                      </div>

                      <p className="mono fine" style={{ color: "var(--ink-4)", lineHeight: 1.6 }}>
                        ~ once installed, register experiments in /dashboard/experiments. the snippet auto-fetches and
                        applies any approved variants. swap <code style={{ color: "var(--ink-3)" }}>EXPERIMENT_ID</code> for the real id from the dashboard.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
