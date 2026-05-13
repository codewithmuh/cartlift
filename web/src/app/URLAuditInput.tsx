"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, publicAudits } from "@/lib/api";

// "Drafting findings…" looks better than a spinner. Steps are aesthetic, not load-bearing.
const STEPS = [
  "fetching the page…",
  "parsing the dom…",
  "reading visible copy…",
  "drafting findings…",
  "scoring uplift…",
] as const;

export default function URLAuditInput({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!busy) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setStep(0);
      return;
    }
    timer.current = setInterval(() => {
      setStep((s) => (s + 1 < STEPS.length ? s + 1 : s));
    }, 1800);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const audit = await publicAudits.run(target);
      window.location.href = `/audit/${audit.slug}`;
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) {
          setErr("too many free audits from this network. try again in an hour, or self-host bandit.");
        } else if (e.status === 400) {
          setErr("that url didn't parse. try the full domain, like yoursite.com.");
        } else {
          setErr(`couldn't run the audit (${e.status}). try again or self-host.`);
        }
      } else {
        setErr("couldn't reach bandit. is the api running?");
      }
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className={`url-input${busy ? " is-busy" : ""}`} aria-busy={busy}>
        <span className="scheme">https://</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={compact ? "your-site.com" : "your-site.com"}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !url.trim()}>
          {busy ? "auditing" : "audit"}
          <span className="blink" aria-hidden />
        </button>
      </form>
      {busy && (
        <div className="url-input-status" role="status" aria-live="polite">
          <span className="mono">● {STEPS[step]}</span>
          <span className="mono" style={{ color: "var(--ink-4)" }}>
            ~ {Math.min(8 + step * 4, 28)}s
          </span>
        </div>
      )}
      {err && (
        <div className="url-input-error mono" role="alert">
          ! {err}
        </div>
      )}
    </div>
  );
}
