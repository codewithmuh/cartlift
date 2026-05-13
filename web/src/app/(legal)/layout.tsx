import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">B</span>
            bandit
          </Link>
          <div className="nav-links">
            <Link href="/" className="mono" style={{ color: "var(--ink-3)" }}>← home</Link>
            <Link href="/signup" className="btn btn-lime">try free →</Link>
          </div>
        </div>
      </nav>

      <main>
        <section style={{ padding: "72px 0 96px" }}>
          <div className="shell-tight">
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                padding: "56px 64px",
                boxShadow: "var(--shadow-md)",
                lineHeight: 1.7,
                color: "var(--ink-2)",
                fontSize: 16,
              }}
            >
              {children}
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
