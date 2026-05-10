"use client";

import { useEffect, useState } from "react";
import { ApiError, api, auth, type Me } from "@/lib/api";

export default function SettingsView() {
  const [me, setMe] = useState<Me | null>(null);
  const [company, setCompany] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    auth.me().then((m) => {
      setMe(m);
      setCompany(m.company);
    }).catch(() => setErr("could not load account"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setBusy(true);
    try {
      const updated = await api<Me>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ company }),
      });
      setMe(updated);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not save (${e.status})`);
      else setErr("could not save");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <p className="fine">loading…</p>;

  return (
    <form onSubmit={save} style={{ background: "var(--bg-1)", border: "1px solid var(--hairline)", borderRadius: 6, padding: 28, maxWidth: 580 }}>
      <div className="eyebrow">account</div>
      <h2 className="mono" style={{ fontSize: 18, marginTop: 14, marginBottom: 24, color: "var(--ink)" }}>
        your <span style={{ color: "var(--lime)" }}>signature</span>
      </h2>

      {err && <div className="form-error">{err}</div>}
      {saved && (
        <div style={{ background: "var(--lime-soft)", border: "1px solid var(--lime-soft)", color: "var(--lime)", fontFamily: "var(--mono)", fontSize: 12, padding: "10px 12px", borderRadius: 4, marginBottom: 14 }}>
          ● saved.
        </div>
      )}

      <div className="field">
        <label>email</label>
        <input type="email" value={me.email} disabled style={{ opacity: 0.6 }} />
        <span className="help">~ contact support to change your email.</span>
      </div>

      <div className="field">
        <label>company</label>
        <input type="text" value={company} placeholder="your company"
          onChange={(e) => setCompany(e.target.value)} />
      </div>

      <button type="submit" className="btn btn-lime" disabled={busy} style={{ justifyContent: "center" }}>
        {busy ? "saving…" : "save changes →"}
      </button>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--hairline)" }}>
        <div className="mono fine" style={{ marginBottom: 8 }}>member since</div>
        <div className="mono" style={{ fontSize: 14, color: "var(--lime)" }}>
          {new Date(me.created_at).toLocaleDateString()}
        </div>
        {me.last_login && (
          <div className="mono fine" style={{ marginTop: 8 }}>
            last sign-in {new Date(me.last_login).toLocaleString()}
          </div>
        )}
      </div>
    </form>
  );
}
