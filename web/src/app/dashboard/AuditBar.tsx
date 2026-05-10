"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPES = [
  { id: "cro", name: "cro" },
  { id: "seo", name: "seo" },
  { id: "compliance", name: "compliance" },
  { id: "gmc", name: "gmc" },
];

export default function AuditBar() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [type, setType] = useState("cro");
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    // Push to /dashboard/audits with query params; AuditsView picks them up.
    router.push(`/dashboard/audits?run=${encodeURIComponent(url.trim())}&type=${type}`);
    setTimeout(() => setBusy(false), 800);
  }

  return (
    <div className="dash-audit-bar">
      <span className="lbl">audit any url</span>
      <form onSubmit={onSubmit}>
        <span className="scheme">https://</span>
        <input
          type="text"
          placeholder="your-site.com or any prospect"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="audit type">
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" disabled={busy}>
          {busy ? "running…" : "audit →"}
        </button>
      </form>
      <span className="hint">~30s</span>
    </div>
  );
}
