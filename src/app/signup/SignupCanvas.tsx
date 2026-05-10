"use client";

import { useSearchParams } from "next/navigation";

function normalize(raw: string): string {
  let url = raw.trim();
  if (url.startsWith("http://")) url = url.slice(7);
  if (url.startsWith("https://")) url = url.slice(8);
  url = url.replace(/\/$/, "");
  return url;
}

export default function SignupCanvas() {
  const searchParams = useSearchParams();
  const auditHint = searchParams.get("audit") || "";
  const display = auditHint ? normalize(auditHint) : "";

  // No audit param — show generic terminal sample.
  if (!auditHint) {
    return (
      <div className="auth-canvas">
        <div className="sample">
          <span className="ln c">$ bandit init --site yourcompany.com</span>
          <span className="ln c">~ creating workspace…</span>
          <span className="ln k">→ workspace ready · token: bnd_xxxx</span>
          <span className="ln c"></span>
          <span className="ln c">$ bandit watch</span>
          <span className="ln c">~ daemon online. monitoring 1 site.</span>
          <span className="ln c">~ first variant draft expected in &lt; 4 min.</span>
          <span className="ln c"></span>
          <span className="ln k">● ready to ship.</span>
        </div>
      </div>
    );
  }

  // With audit param — show a live "your audit is being prepared" preview.
  return (
    <div className="auth-canvas">
      <div className="audit-preview">
        <div className="preview-bar">
          <div className="dots"><span /><span /><span /></div>
          <div className="url">
            <span style={{ color: "var(--ink-4)" }}>https://</span>
            <span>{display}</span>
          </div>
          <span className="live">analysing</span>
        </div>

        <div className="preview-stage">
          <div className="preview-status">
            <div className="step done">
              <span className="marker" /> fetched · 312 KB · 1.4s
            </div>
            <div className="step done">
              <span className="marker" /> parsed · 47 components · 12 funnels
            </div>
            <div className="step now">
              <span className="marker" /> drafting findings…
            </div>
            <div className="step pending">
              <span className="marker" /> writing variants…
            </div>
          </div>

          <div className="preview-finding">
            <span className="sev high" />
            <div className="body">
              <strong>hero · headline</strong> — vague benefit. category not named in first 4 words.
            </div>
            <span className="lift">+18.3%</span>
          </div>
          <div className="preview-finding">
            <span className="sev medium" />
            <div className="body">
              <strong>hero · cta</strong> — low-contrast button. mobile-fold cut at 67%.
            </div>
            <span className="lift">+9.4%</span>
          </div>
          <div className="preview-finding locked">
            <span className="sev medium" />
            <div className="body">
              <strong>social proof</strong> — missing customer logos in the first viewport.
            </div>
            <span className="lift">+7.1%</span>
          </div>
          <div className="preview-finding locked">
            <span className="sev low" />
            <div className="body">
              <strong>pricing</strong> — gated behind footer. self-disqualification risk.
            </div>
            <span className="lift">+4.2%</span>
          </div>

          <div className="preview-locked-note">
            <strong>two more findings unlock with your account →</strong>
            <br />
            free, no card. takes ~30 seconds.
          </div>
        </div>
      </div>
    </div>
  );
}
