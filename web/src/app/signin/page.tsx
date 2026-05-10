import type { Metadata } from "next";
import SigninForm from "./SigninForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Bandit dashboard. Run audits, manage experiments, ship winning variants.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

export default function SigninPage() {
  return (
    <div className="auth-shell">
      <div className="auth-canvas">
        <div className="sample">
          <span className="ln c">$ bandit audit https://yeti.co</span>
          <span className="ln c">~ fetching… ~ analysing… ~ writing variants…</span>
          <span className="ln c">───────────────────────────────────</span>
          <span className="ln k">→ hero · headline · v07          +18.3%</span>
          <span className="ln k">→ checkout · button copy · v03   +11.4%</span>
          <span className="ln k">→ pricing · sticky cta · v02      +7.1%</span>
          <span className="ln c">───────────────────────────────────</span>
          <span className="ln c">  total uplift this run: <span style={{ color: "var(--lime)" }}>+38.3%</span></span>
        </div>
      </div>
      <SigninForm />
    </div>
  );
}
