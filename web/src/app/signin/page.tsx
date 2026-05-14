import type { Metadata } from "next";
import SigninForm from "./SigninForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cartlift dashboard. Run audits, manage experiments, ship winning variants on your store.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

export default function SigninPage() {
  return (
    <div className="auth-shell">
      <div className="auth-canvas">
        <div className="sample">
          <span className="ln c">$ cartlift audit https://glowly.kr --all</span>
          <span className="ln c">~ cro · seo · compliance · gmc · 4 checks</span>
          <span className="ln c">───────────────────────────────────────</span>
          <span className="ln k">→ cro         hero.headline · v07     +18.3%</span>
          <span className="ln k">→ cro         checkout.cta · v03      +11.4%</span>
          <span className="ln k">→ seo         meta.description · v04   +6.2%</span>
          <span className="ln c">→ compliance  ftc disclosure              fix</span>
          <span className="ln c">→ gmc         feed.title length       2 warn</span>
          <span className="ln c">───────────────────────────────────────</span>
          <span className="ln c">  uplift this run: <span style={{ color: "var(--lime)" }}>+35.9%</span> · 2 to review</span>
        </div>
      </div>
      <SigninForm />
    </div>
  );
}
