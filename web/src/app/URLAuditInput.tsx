"use client";

import { useState } from "react";

export default function URLAuditInput({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // For now, push to signup with the URL as a hint param.
    const target = url.trim();
    const next = target
      ? `/signup?audit=${encodeURIComponent(target)}`
      : `/signup`;
    window.location.href = next;
  }

  return (
    <form onSubmit={onSubmit} className="url-input">
      <span className="scheme">https://</span>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={compact ? "your-site.com" : "your-site.com"}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit">
        audit
        <span className="blink" aria-hidden />
      </button>
    </form>
  );
}
