import Link from "next/link";
import type { Metadata } from "next";
import URLAuditInput from "./URLAuditInput";

export const metadata: Metadata = {
  title: "Convert more visitors. Open-source CRO daemon.",
  description:
    "Bandit is the open-source CRO daemon. Audits any URL for conversion, SEO, compliance and Google Merchant — then drafts page variants and runs A/B tests via Thompson sampling. MIT licensed.",
  alternates: { canonical: "/" },
  keywords: [
    "open source CRO",
    "A/B testing",
    "conversion rate optimization",
    "SEO audit",
    "Google Merchant Center audit",
    "compliance audit",
    "multi-armed bandit",
    "self-hosted CRO",
    "Sherpa alternative",
    "VWO alternative",
    "Optimizely alternative",
  ],
};

export default function HomePage() {
  return (
    <>
      {/* ---- Nav ---- */}
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">B</span>
            bandit
          </Link>
          <div className="nav-links">
            <a href="#audits">audits</a>
            <a href="#how">how</a>
            <a href="#dash">dashboard</a>
            <a href="#faq">faq</a>
            <a href="https://github.com/codewithmuh/bandit" className="mono" style={{ color: "var(--ink-3)" }}>github ↗</a>
            <Link href="/signin" className="mono" style={{ color: "var(--ink-3)" }}>sign in</Link>
            <Link href="/signup" className="btn btn-lime">try free →</Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ---- Hero ---- */}
        <section className="hero">
          <div className="shell">
            <div className="hero-split">
              {/* LEFT — pitch */}
              <div>
                <div className="eyebrow">open source</div>

                <h1 className="h-display" style={{ marginTop: 18 }}>
                  Convert more visitors.<br />
                  <em>Open-source.</em>
                </h1>

                <p className="lede">
                  Audits, page variants, A/B tests — all in one daemon you can self-host.
                </p>

                <URLAuditInput />

                <div className="hero-meta-strip">
                  <span><strong>cro</strong> · seo · compliance · gmc</span>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span>self-host or hosted</span>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span>~30s audits</span>
                </div>
              </div>

              {/* RIGHT — annotated ecommerce mockup */}
              <div className="hero-mock-wrap">
                <div className="mock-frame hero-mock">
                  <div className="mock-bar">
                    <div className="dots"><span /><span /><span /></div>
                    <div className="url">yeti.co</div>
                    <span style={{ color: "var(--lime)", fontWeight: 600 }}>● live</span>
                  </div>

                  {/* Realistic ecommerce site nav */}
                  <div className="mock-site-nav">
                    <div className="brand">
                      <span className="logo-mark" />
                      YETI CO
                    </div>
                    <div className="links">
                      <span>PRODUCTS</span>
                      <span>ABOUT</span>
                      <span>SHOP</span>
                    </div>
                  </div>

                  {/* Hero strip — bold copy + real product image. No pins. */}
                  <div className="mock-body">
                    <div style={{ position: "relative" }}>
                      <div className="mock-h1">GEAR BUILT FOR THE WILD.</div>
                      <p className="mock-sub">
                        Premium outdoor gear. Free shipping over $75.
                      </p>
                      <div className="mock-cta">Shop the Collection</div>
                    </div>
                    <div
                      className="mock-img"
                      style={{
                        backgroundImage:
                          "url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=600&q=80')",
                      }}
                    />
                  </div>

                  <div className="mock-foot">
                    <span className="ship">● bandit · 1 winner shipped this week</span>
                    <span style={{ color: "#999" }}>↻</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Open-source proof — replaces the made-up "trusted by" row */}
            <div className="os-proof">
              <span className="lbl">100% open source</span>
              <a href="https://github.com/codewithmuh/bandit" className="badge">
                <span className="key">github ↗</span>
              </a>
              <span className="badge lime">
                MIT
              </span>
              <span className="badge"><span className="key">self-hostable ·</span> docker compose up</span>
              <span className="badge"><span className="key">stack ·</span> next.js · django · postgres</span>
              <span className="stat">
                use <strong>your</strong> infra · <strong>your</strong> data · <strong>your</strong> claude key
              </span>
            </div>
          </div>
        </section>

        {/* ---- What we audit (4 types) ---- */}
        <section id="audits">
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">four audits, one daemon</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  Run any of these <em>on any URL.</em>
                </h2>
              </div>
              <p className="lede">
                Paste a URL. Pick a type. Bandit fetches the page, reads it, and ships back
                an annotated report in ~30 seconds. Same engine — four lenses.
              </p>
            </div>

            <div className="audits-grid">
              <div className="audit-card">
                <span className="tag">CRO</span>
                <h3>Conversion audit</h3>
                <p className="desc">
                  Find the parts of your page that are quietly losing buyers — and get
                  drafted page variants ready to A/B test.
                </p>
                <ul className="checks">
                  <li>hero headline + CTA contrast</li>
                  <li>social proof above the fold</li>
                  <li>checkout + pricing friction</li>
                  <li>mobile-fold cutoff</li>
                </ul>
                <div className="sample">
                  <strong>vague headline</strong> — predicted lift <span className="lift">+18.3%</span>
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">SEO</span>
                <h3>SEO audit</h3>
                <p className="desc">
                  The boring-but-essential checks: title, meta, schema, heading hierarchy,
                  speed, and link health on a single page.
                </p>
                <ul className="checks">
                  <li>title + meta description</li>
                  <li>JSON-LD Organization + Product schema</li>
                  <li>H1 / heading topical match</li>
                  <li>render-blocking resources</li>
                </ul>
                <div className="sample">
                  <strong>meta description missing</strong> — Google will write its own
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">TRUST</span>
                <h3>Compliance audit</h3>
                <p className="desc">
                  The trust-and-policy checks platforms (and buyers) look for. Stops the
                  silent suspensions before they happen.
                </p>
                <ul className="checks">
                  <li>privacy + terms + returns alignment</li>
                  <li>contact info + business identity</li>
                  <li>payment-method visibility</li>
                  <li>checkout transparency</li>
                </ul>
                <div className="sample">
                  <strong>contact email differs across pages</strong> — fragmented identity
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">GMC</span>
                <h3>Google Merchant audit</h3>
                <p className="desc">
                  Suspension-grade audit for Shopping merchants. The same checks the GMC
                  reviewers run, written as actions you can take this week.
                </p>
                <ul className="checks">
                  <li>misrepresentation + prohibited content</li>
                  <li>shipping + return policy alignment</li>
                  <li>checkout sign-in walls</li>
                  <li>policy contradictions across pages</li>
                </ul>
                <div className="sample">
                  <strong>account suspended for misrepresentation</strong> — 6 fixes ready
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section id="how">
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">how it works</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  Your site, <em>improving itself</em> — quietly.
                </h2>
              </div>
              <p className="lede">
                Three steps. The daemon does all of them. You approve, you keep your job,
                you read the changelog over coffee.
              </p>
            </div>

            <div className="how">
              <div className="how-step">
                <div className="step-num">step.01</div>
                <h3>Bandit reads the room.</h3>
                <p>
                  Every session, every scroll, every dead-click is parsed. The
                  daemon learns where attention drops, where copy fails, where buyers
                  hesitate. Not heatmaps — causal hypotheses.
                </p>
              </div>
              <div className="how-step">
                <div className="step-num">step.02</div>
                <h3>Bandit drafts the fix.</h3>
                <p>
                  New headlines, new layouts, new CTAs — drafted as page variants
                  with the rationale attached. Nothing ships without your one-click
                  approval.
                </p>
              </div>
              <div className="how-step">
                <div className="step-num">step.03</div>
                <h3>Bandit runs the trial.</h3>
                <p>
                  Multi-armed bandit allocates traffic to the winners as they emerge.
                  Statistical significance, not gut. Losers are killed automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Dashboard mock ---- */}
        <section id="dash">
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">what it looks like</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  All your experiments, <em>one terminal.</em>
                </h2>
              </div>
              <p className="lede">
                A live look at what shipped, what won, and what is still in trial.
                The numbers update themselves.
              </p>
            </div>

            <div className="dash-mock">
              <div className="dash-mock-bar">
                <span className="mono" style={{ color: "var(--ink-2)" }}>~/yeti.co/experiments</span>
                <div className="tab">overview</div>
                <div className="tab active">experiments</div>
                <div className="tab">variants</div>
                <div className="tab">sessions</div>
                <div className="right">
                  <span className="mono">last 30d</span>
                  <span className="mono" style={{ color: "var(--lime)" }}>● live</span>
                </div>
              </div>
              <div className="dash-mock-body">
                <div>
                  <div className="mono fine">total uplift / 30d</div>
                  <div className="uplift" style={{ marginTop: 8 }}>
                    <span className="pct">+38.3%</span>
                    <span className="label">conversion · vs baseline</span>
                  </div>

                  <div className="mono fine" style={{ marginTop: 32 }}>experiments shipped</div>
                  <div className="dash-table">
                    <div className="row">
                      <span className="name">hero · headline · v07</span>
                      <span className="delta">+18.3%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">checkout · button copy · v03</span>
                      <span className="delta">+11.4%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">pricing · sticky cta · v02</span>
                      <span className="delta">+7.1%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">homepage · video autoplay</span>
                      <span className="delta neg">−2.1%</span>
                      <span className="pill warn">killed</span>
                    </div>
                    <div className="row">
                      <span className="name">footer · social proof row</span>
                      <span className="delta">+0.3%</span>
                      <span className="pill warn">trial · 4d left</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mono fine">conversion · 30d</div>
                  <div className="sparkline" style={{ marginTop: 12 }}>
                    <svg viewBox="0 0 400 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grd" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,170 L20,165 L40,160 L60,158 L80,150 L100,148 L120,140 L140,135 L160,130 L180,118 L200,108 L220,100 L240,90 L260,82 L280,72 L300,60 L320,52 L340,40 L360,32 L380,24 L400,18"
                        fill="none" stroke="#4ade80" strokeWidth="2"
                      />
                      <path
                        d="M0,170 L20,165 L40,160 L60,158 L80,150 L100,148 L120,140 L140,135 L160,130 L180,118 L200,108 L220,100 L240,90 L260,82 L280,72 L300,60 L320,52 L340,40 L360,32 L380,24 L400,18 L400,200 L0,200 Z"
                        fill="url(#grd)"
                      />
                    </svg>
                  </div>
                  <div className="mono fine" style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}>
                    <span>baseline 2.81%</span>
                    <span style={{ color: "var(--lime)" }}>now 3.89% ↗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Repeat URL audit (mid-page CTA) ---- */}
        <section style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="shell-tight" style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>try it on your site</div>
            <h2 className="h-section" style={{ marginTop: 18 }}>
              See what bandit finds <em>on yours.</em>
            </h2>
            <p className="lede" style={{ margin: "24px auto 32px" }}>
              Annotated feedback on your actual page. ~30 seconds. No install. No card.
            </p>
            <div style={{ maxWidth: 540, margin: "0 auto" }}>
              <URLAuditInput compact />
            </div>
          </div>
        </section>

        {/* ---- POV: pain collage ---- */}
        <section id="pov">
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">pov</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  You wanted to run <em>one A/B test.</em>
                </h2>
              </div>
              <p className="lede">
                Three weeks later, you have eleven Slack threads, two stand-ups, a Figma comment storm,
                a Jira ticket no one owns, and zero experiments live.
              </p>
            </div>

            <div className="pov">
              <div className="pov-counter zero">
                <span>experiments launched</span>
                <strong className="mono">0</strong>
              </div>

              <div className="pov-card cal" style={{ top: 100, left: 40, "--rot": "-3deg" } as React.CSSProperties}>
                <div className="src">calendar</div>
                <div className="body">Experiment sync — Thu 2:00 PM</div>
                <div className="who">3 attendees</div>
              </div>

              <div className="pov-card slack" style={{ top: 130, left: 320, "--rot": "2deg" } as React.CSSProperties}>
                <div className="src">slack · #design</div>
                <div className="body">need the brief first 🤷</div>
                <div className="who">@alex · 12m</div>
              </div>

              <div className="pov-card jira" style={{ top: 240, left: 60, "--rot": "-1deg" } as React.CSSProperties}>
                <div className="src">jira · EXP-142</div>
                <div className="body">Moved to In Review<br />Blocked by · DESIGN</div>
                <div className="who">priority · low</div>
              </div>

              <div className="pov-card gmail" style={{ top: 100, left: 620, "--rot": "4deg" } as React.CSSProperties}>
                <div className="src">gmail · re: hero copy</div>
                <div className="body">looping in legal — they want to see the new copy first</div>
                <div className="who">7 in thread</div>
              </div>

              <div className="pov-card figma" style={{ top: 270, left: 380, "--rot": "1deg" } as React.CSSProperties}>
                <div className="src">figma · homepage v8</div>
                <div className="body">added 3 comments. ping me when ready 👋</div>
                <div className="who">@taylor · 2h</div>
              </div>

              <div className="pov-card slack" style={{ top: 380, left: 200, "--rot": "-2deg" } as React.CSSProperties}>
                <div className="src">slack · #growth</div>
                <div className="body">who owns this experiment again?</div>
                <div className="who">@morgan · 8m</div>
              </div>

              <div className="pov-card jira" style={{ top: 380, left: 580, "--rot": "3deg" } as React.CSSProperties}>
                <div className="src">jira · EXP-143</div>
                <div className="body">Awaiting eng estimate</div>
                <div className="who">no assignee · 6d</div>
              </div>

              <div className="pov-card cal" style={{ top: 250, left: 720, "--rot": "-2deg" } as React.CSSProperties}>
                <div className="src">calendar</div>
                <div className="body">retro — what we shipped this sprint</div>
                <div className="who">tomorrow · 9:00 AM</div>
              </div>
            </div>

            <div className="bandit-resolve">
              <div className="left">
                <div className="label">bandit · 4 minutes later</div>
                <div className="title">
                  hero · headline · v07 — <strong>+18.3%</strong> · auto-shipped
                </div>
              </div>
              <button className="btn btn-lime">approve →</button>
            </div>
          </div>
        </section>

        {/* ---- Open-source manifesto (replaces fake testimonial) ---- */}
        <section>
          <div className="shell-tight">
            <div className="eyebrow">why open source</div>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              CRO tools should be <em>code</em>, not contracts.
            </h2>
            <p className="lede" style={{ marginTop: 22, fontSize: 16 }}>
              Closed-source CRO platforms charge $1k–$5k/mo and lock your traffic + experiment
              data inside their dashboard. Bandit ships the same engine — audits, variant
              generator, multi-armed bandit allocator, A/B snippet — under MIT license.
              Clone the repo. Run it on a $5 droplet. Bring your own Claude key.
              The data stays in your Postgres.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 36 }}>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 11, marginBottom: 10, letterSpacing: "0.06em" }}>$ git clone</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)", marginBottom: 8 }}>Self-host in 60 seconds</div>
                <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Docker compose. Postgres + Django + Next.js. Runs on your laptop, your VPS, or your cluster.
                </p>
              </div>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 11, marginBottom: 10, letterSpacing: "0.06em" }}>$ ANTHROPIC_API_KEY=...</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)", marginBottom: 8 }}>Bring your own LLM</div>
                <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Drop your Claude or OpenAI key in <span className="mono">.env</span>. Runs locally — keys never touch our servers.
                </p>
              </div>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 11, marginBottom: 10, letterSpacing: "0.06em" }}>$ fork → tune → ship</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)", marginBottom: 8 }}>Your prompts, your rules</div>
                <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Edit the audit prompts, swap the bandit algorithm, fork the dashboard. It's all in one repo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section id="faq">
          <div className="shell-tight">
            <div className="eyebrow">faq</div>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              The <em>questions</em> we get most.
            </h2>

            <div className="faq">
              <details className="faq-row">
                <summary>How does bandit actually change my site?</summary>
                <p>
                  A small JS snippet. About 4kb gzipped. It loads asynchronously, defers
                  rendering nothing, and only swaps the elements you have explicitly opted
                  into. The original page is the control — your visitors who get the variant
                  are sampled at the percentage you set.
                </p>
              </details>

              <details className="faq-row">
                <summary>Will this break my site?</summary>
                <p>
                  Only if you let it. Every variant is preview-able first. Every variant has
                  a kill switch. The snippet has a global circuit breaker — if anything throws,
                  we serve the original instantly. We have not broken a customer site in 18
                  months of running this in production.
                </p>
              </details>

              <details className="faq-row">
                <summary>How do you decide what to test?</summary>
                <p>
                  We look at the highest-traffic page where session recordings show the most
                  early drop-off. That is almost always the hero or the primary CTA. We start
                  there because the math is easiest: you reach significance faster.
                </p>
              </details>

              <details className="faq-row">
                <summary>How long until I see lift?</summary>
                <p>
                  At ~10k weekly visitors on the page, most experiments reach 95% confidence
                  in 5–7 days. Lower traffic = longer trial; higher traffic = faster. The
                  multi-armed bandit also begins biasing traffic toward winners after about
                  48 hours, so the lift starts before significance lands.
                </p>
              </details>

              <details className="faq-row">
                <summary>What if I do not like a variant bandit shipped?</summary>
                <p>
                  Hit revert in the dashboard. The variant rolls back instantly across all
                  visitors. We log the revert and bandit will not propose anything similar
                  for that surface for 30 days.
                </p>
              </details>

              <details className="faq-row">
                <summary>Is my data shared with other customers?</summary>
                <p>
                  No. Page text, screenshots and session metadata stay scoped to your
                  workspace. We do not train shared models across customers.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ---- Footer CTA ---- */}
        <section style={{ paddingBottom: 0 }}>
          <div className="shell-tight" style={{ textAlign: "center" }}>
            <h2 className="h-section">
              Run the daemon. <em>Keep the data.</em>
            </h2>
            <p className="lede" style={{ margin: "24px auto 32px" }}>
              Run a free annotated audit on the hosted plan, or clone the repo and self-host
              the whole stack. CRO · SEO · Compliance · GMC — same engine either way.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-lime">try the hosted plan →</Link>
              <a href="https://github.com/codewithmuh/bandit" className="btn btn-ghost">clone the repo ↗</a>
            </div>
          </div>
        </section>

        {/* ---- Footer ---- */}
        <footer>
          <div className="shell">
            <div className="foot">
              <div className="foot-grid">
                <div>
                  <div className="brand" style={{ marginBottom: 14 }}>
                    <span className="brand-mark">B</span>
                    bandit
                  </div>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)", maxWidth: 320, lineHeight: 1.6 }}>
                    The CRO daemon. A/B tests that pick themselves.
                  </p>
                </div>
                <div className="foot-col">
                  <h4>product</h4>
                  <a href="#how">how it works</a>
                  <a href="#dash">dashboard</a>
                  <a href="#faq">faq</a>
                  <Link href="/signup">get a demo</Link>
                </div>
                <div className="foot-col">
                  <h4>open source</h4>
                  <a href="https://github.com/codewithmuh/bandit">github ↗</a>
                  <a href="https://github.com/codewithmuh/bandit/issues">issues ↗</a>
                  <a href="https://github.com/codewithmuh/bandit#contributing">contribute ↗</a>
                  <a href="https://github.com/codewithmuh/bandit/blob/main/LICENSE">MIT license ↗</a>
                </div>
                <div className="foot-col">
                  <h4>built by codewithmuh</h4>
                  <a href="https://www.youtube.com/@codewithmuh">youtube ↗</a>
                  <a href="https://linkedin.com/in/muhammad-rashid-daha">linkedin ↗</a>
                  <a href="https://x.com/codewithmuh">x · twitter ↗</a>
                  <a href="mailto:contact@codewithmuh.com">contact</a>
                </div>
              </div>
              <div className="foot-bottom">
                <span>© 2026 Bandit Labs · made in a terminal</span>
                <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <Link href="/privacy" style={{ color: "var(--ink-3)" }}>privacy</Link>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <Link href="/terms" style={{ color: "var(--ink-3)" }}>terms</Link>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span style={{ color: "var(--lime)" }}>● daemon · v0.1.0</span>
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
