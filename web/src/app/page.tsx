import Link from "next/link";
import type { Metadata } from "next";
import URLAuditInput from "./URLAuditInput";
import GithubStars from "./GithubStars";
import NavAuthLinks from "./NavAuthLinks";

export const metadata: Metadata = {
  title: "Lift every cart. Open-source ecommerce CRO.",
  description:
    "Cartlift is the open-source CRO platform for ecommerce. Audits your store pages, drafts conversion variants, ships them via a snippet, and runs Thompson-sampled A/B tests that auto-pin winners. More buyers. Higher AOV. Repeat customers. MIT licensed.",
  alternates: { canonical: "/" },
  keywords: [
    "ecommerce CRO",
    "open source ecommerce CRO",
    "Shopify A/B testing",
    "WooCommerce A/B testing",
    "BigCommerce optimization",
    "product page optimization",
    "checkout optimization",
    "AOV uplift",
    "repeat customer rate",
    "Google Merchant Center audit",
    "self-hosted CRO",
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
            <span className="brand-mark">C</span>
            cartlift
          </Link>
          <div className="nav-links">
            <a
              href="https://github.com/codewithmuh/bandit"
              className="btn btn-ghost btn-gh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Cartlift on GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.32c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.16-.89-1.16-.73-.5.05-.49.05-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.52.56.83 1.28.83 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span>github</span>
            </a>
            <NavAuthLinks />
          </div>
        </div>
      </nav>

      <main>
        {/* ---- Hero — focused, animated, k-beauty PDP mock ---- */}
        <section className="hero">
          <div className="shell">
            <div className="hero-split">
              {/* LEFT — pitch (tighter, more breathing room) */}
              <div className="hero-pitch">
                <div className="eyebrow">the open-source ecommerce growth daemon</div>

                <h1 className="h-display hero-h1">
                  Lift every cart.<br />
                  <em>Grow your store.</em>
                </h1>

                <p className="lede hero-lede">
                  Paste your store URL — Cartlift audits it, drafts conversion variants,
                  and runs the A/B tests <strong>for you</strong>. Winners ship
                  automatically. More buyers, higher AOV, repeat customers — no agency.
                </p>

                <URLAuditInput />

                <div className="hero-meta-strip">
                  <span><strong>cro</strong> · seo · trust · shopping feed</span>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span>~30s audits</span>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span>self-host or hosted</span>
                </div>
              </div>

              {/* RIGHT — K-beauty PDP mock with cartlift testing overlay */}
              <div className="hero-mock-wrap">
                <div className="mock-frame hero-mock">
                  <div className="mock-bar">
                    <div className="dots"><span /><span /><span /></div>
                    <div className="url">glowly.kr / products / glass-skin-serum</div>
                    <span className="live-dot" style={{ color: "var(--lime)", fontWeight: 600 }}>● live</span>
                  </div>

                  {/* K-beauty store nav */}
                  <div className="mock-site-nav">
                    <div className="brand">
                      <span className="logo-mark" />
                      GLOWLY
                    </div>
                    <div className="links">
                      <span>NEW</span>
                      <span>SKIN</span>
                      <span>SHOP</span>
                    </div>
                  </div>

                  {/* PDP body — image left, info right */}
                  <div className="mock-pdp">
                    <div
                      className="mock-pdp-image"
                      style={{
                        backgroundImage:
                          "url('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80')",
                      }}
                      aria-hidden="true"
                    >
                      <span className="mock-pdp-badge">★ bestseller</span>
                    </div>

                    <div className="mock-pdp-info">
                      <div className="mock-pdp-rating">
                        ★★★★★ <span className="reviews">12,403 reviews</span>
                      </div>
                      <h2 className="mock-pdp-title">
                        <span className="swap">Wake up with</span><br />
                        glass skin.
                      </h2>
                      <div className="mock-pdp-price">
                        $32 <span className="strike">$45</span>
                      </div>
                      <button className="mock-pdp-cta" type="button" tabIndex={-1}>
                        add to cart
                      </button>
                      <div className="mock-pdp-ship">↻ free shipping over $40 · 14-day returns</div>
                    </div>

                    {/* Floating cartlift-testing overlay — the storytelling moment */}
                    <div className="mock-cartlift-overlay" aria-hidden="true">
                      <span className="mco-dot" />
                      cartlift · pdp headline (v3)
                      <strong className="mco-lift">+14.2%</strong>
                    </div>
                  </div>

                  <div className="mock-foot">
                    <span className="ship">● cartlift · 1 winner shipped this week</span>
                    <span style={{ color: "#999" }}>↻</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- What we audit (4 types) ---- */}
        <section id="audits" data-reveal>
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">four audits, one growth daemon</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  Run any of these <em>on every page that sells.</em>
                </h2>
              </div>
              <p className="lede">
                Paste a product page, a collection, or your checkout. Cartlift fetches the
                page, reads it, and ships back an annotated growth report in ~30 seconds.
                Same engine — four lenses for ecommerce.
              </p>
            </div>

            <div className="audits-grid">
              <div className="audit-card">
                <span className="tag">CRO</span>
                <h3>Conversion audit</h3>
                <p className="desc">
                  Find the parts of your PDP, cart and checkout that are quietly losing
                  buyers — and get drafted page variants ready to A/B test.
                </p>
                <ul className="checks">
                  <li>pdp headline + add-to-cart contrast</li>
                  <li>social proof above the fold</li>
                  <li>checkout + payment-method friction</li>
                  <li>mobile cart cutoff</li>
                </ul>
                <div className="sample">
                  <strong>weak add-to-cart copy</strong> — predicted lift <span className="lift">+18.3%</span>
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">SEO</span>
                <h3>SEO audit</h3>
                <p className="desc">
                  The boring-but-essential checks: title, meta, Product schema, heading
                  hierarchy, speed, and link health — on the pages that actually rank.
                </p>
                <ul className="checks">
                  <li>title + meta description</li>
                  <li>Product + Offer + Review JSON-LD</li>
                  <li>H1 / heading topical match</li>
                  <li>render-blocking resources</li>
                </ul>
                <div className="sample">
                  <strong>product schema missing offer.price</strong> — invisible to Google Shopping
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">TRUST</span>
                <h3>Trust + policy audit</h3>
                <p className="desc">
                  The checks shoppers (and Stripe, PayPal, Shop Pay) look for. Stops
                  abandoned carts and silent suspensions before they happen.
                </p>
                <ul className="checks">
                  <li>privacy + terms + returns alignment</li>
                  <li>contact info + business identity</li>
                  <li>payment-method visibility</li>
                  <li>checkout transparency</li>
                </ul>
                <div className="sample">
                  <strong>return policy contradicts shipping page</strong> — buyers bounce
                </div>
              </div>

              <div className="audit-card">
                <span className="tag">GMC</span>
                <h3>Google Merchant audit</h3>
                <p className="desc">
                  Suspension-grade audit for Shopping merchants. The same checks GMC
                  reviewers run, written as actions you can ship this week.
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
        <section id="how" data-reveal>
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">how it works</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  Your store, <em>improving itself</em> — quietly.
                </h2>
              </div>
              <p className="lede">
                Three steps. Cartlift does all of them. You approve, you keep selling, you
                read the changelog over coffee.
              </p>
            </div>

            <div className="how">
              <div className="how-step">
                <div className="step-num">step.01</div>
                <h3>Cartlift reads the page.</h3>
                <p>
                  Paste a URL. Cartlift fetches the live HTML, parses the visible copy +
                  structure, and runs a Claude (or OpenAI) audit against it — conversion,
                  SEO, trust, or Shopping feed. Findings come back annotated with
                  predicted lift in ~30 seconds.
                </p>
              </div>
              <div className="how-step">
                <div className="step-num">step.02</div>
                <h3>Cartlift drafts the variants.</h3>
                <p>
                  Each conversion finding becomes a draft Experiment with 2–3 candidate
                  rewrites — PDP headlines, add-to-cart copy, trust rows, upsell hooks,
                  pricing micro-copy. Every variant carries its rationale. Nothing ships
                  without your one-click approval.
                </p>
              </div>
              <div className="how-step">
                <div className="step-num">step.03</div>
                <h3>Cartlift runs the trial.</h3>
                <p>
                  Approved variants ship through a 3KB JS snippet — drop it in Shopify,
                  WooCommerce, BigCommerce, or any headless front-end. A Thompson-sampling
                  allocator re-weights every 30 min as orders come in. When the leader
                  hits ≥95% posterior confidence on ≥500 samples with positive uplift, it
                  pins to 100% traffic — losers trimmed to 0.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Dashboard mock ---- */}
        <section id="dash" data-reveal>
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">what it looks like</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  All your store experiments, <em>one terminal.</em>
                </h2>
              </div>
              <p className="lede">
                A live look at what shipped, what won, and what is still in trial. AOV,
                conversion, returning-customer rate — all in one view. The numbers update
                themselves.
              </p>
            </div>

            <div className="dash-mock">
              <div className="dash-mock-bar">
                <span className="mono" style={{ color: "var(--ink-2)" }}>~/yourstore.com/experiments</span>
                <div className="tab">overview</div>
                <div className="tab active">experiments</div>
                <div className="tab">audits</div>
                <div className="tab">stores</div>
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
                      <span className="name">pdp · hero headline · v07</span>
                      <span className="delta">+18.3%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">checkout · button copy · v03</span>
                      <span className="delta">+11.4%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">cart · sticky upsell · v02</span>
                      <span className="delta">+7.1%</span>
                      <span className="pill">winner</span>
                    </div>
                    <div className="row">
                      <span className="name">homepage · video autoplay</span>
                      <span className="delta neg">−2.1%</span>
                      <span className="pill warn">killed</span>
                    </div>
                    <div className="row">
                      <span className="name">footer · trust + reviews row</span>
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
                          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,170 L20,165 L40,160 L60,158 L80,150 L100,148 L120,140 L140,135 L160,130 L180,118 L200,108 L220,100 L240,90 L260,82 L280,72 L300,60 L320,52 L340,40 L360,32 L380,24 L400,18"
                        fill="none" stroke="#fb923c" strokeWidth="2"
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
        <section data-reveal style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="shell-tight" style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>try it on your store</div>
            <h2 className="h-section" style={{ marginTop: 18 }}>
              See what cartlift finds <em>on yours.</em>
            </h2>
            <p className="lede" style={{ margin: "24px auto 32px" }}>
              Annotated feedback on your actual product page. ~30 seconds. No install. No card.
            </p>
            <div style={{ maxWidth: 540, margin: "0 auto" }}>
              <URLAuditInput compact />
            </div>
          </div>
        </section>

        {/* ---- POV: pain collage ---- */}
        <section id="pov" data-reveal>
          <div className="shell">
            <div className="sec-head">
              <div>
                <div className="eyebrow">pov · before cartlift</div>
                <h2 className="h-section" style={{ marginTop: 16 }}>
                  You wanted to ship <em>one A/B test.</em>
                </h2>
              </div>
              <p className="lede">
                Three weeks later, you have eleven Slack threads, two stand-ups, a Figma
                comment storm, a Linear ticket no one owns, and zero variants live on
                your store. Cartlift replaces all of it: it audits, drafts, ships, and
                auto-pins the winner from one repo.
              </p>
            </div>

            <div className="pov">
              <div className="pov-counter zero">
                <span>variants live</span>
                <strong className="mono">0</strong>
              </div>

              <div className="pov-card cal" style={{ top: 100, left: 40, "--rot": "-3deg" } as React.CSSProperties}>
                <div className="src">calendar</div>
                <div className="body">Conversion sync — Thu 2:00 PM</div>
                <div className="who">3 attendees</div>
              </div>

              <div className="pov-card slack" style={{ top: 130, left: 320, "--rot": "2deg" } as React.CSSProperties}>
                <div className="src">slack · #design</div>
                <div className="body">need the brief first</div>
                <div className="who">@alex · 12m</div>
              </div>

              <div className="pov-card jira" style={{ top: 240, left: 60, "--rot": "-1deg" } as React.CSSProperties}>
                <div className="src">linear · EXP-142</div>
                <div className="body">Moved to In Review<br />Blocked by · DESIGN</div>
                <div className="who">priority · low</div>
              </div>

              <div className="pov-card gmail" style={{ top: 100, left: 620, "--rot": "4deg" } as React.CSSProperties}>
                <div className="src">gmail · re: pdp copy</div>
                <div className="body">looping in legal — they want to see the new copy first</div>
                <div className="who">7 in thread</div>
              </div>

              <div className="pov-card figma" style={{ top: 270, left: 380, "--rot": "1deg" } as React.CSSProperties}>
                <div className="src">figma · pdp v8</div>
                <div className="body">added 3 comments. ping me when ready</div>
                <div className="who">@taylor · 2h</div>
              </div>

              <div className="pov-card slack" style={{ top: 380, left: 200, "--rot": "-2deg" } as React.CSSProperties}>
                <div className="src">slack · #growth</div>
                <div className="body">who owns this experiment again?</div>
                <div className="who">@morgan · 8m</div>
              </div>

              <div className="pov-card jira" style={{ top: 380, left: 580, "--rot": "3deg" } as React.CSSProperties}>
                <div className="src">linear · EXP-143</div>
                <div className="body">Awaiting eng estimate</div>
                <div className="who">no assignee · 6d</div>
              </div>

              <div className="pov-card cal" style={{ top: 250, left: 720, "--rot": "-2deg" } as React.CSSProperties}>
                <div className="src">calendar</div>
                <div className="body">retro — what we shipped this sprint</div>
                <div className="who">tomorrow · 9:00 AM</div>
              </div>
            </div>

            <div className="bandit-resolve-v2">
              <div className="resolve-head">
                <span className="resolve-label">
                  <span className="resolve-dot" />
                  cartlift · same workflow, one repo
                </span>
                <span className="resolve-counter">
                  variants live <strong>3</strong>
                </span>
              </div>

              <ol className="resolve-steps">
                <li>
                  <span className="step-time">~30s</span>
                  <span className="step-body">
                    paste the url → cartlift returns ranked conversion findings with predicted lift
                  </span>
                </li>
                <li>
                  <span className="step-time">1 click</span>
                  <span className="step-body">
                    pick a finding → claude (or openai) drafts 3 candidate rewrites with rationale
                  </span>
                </li>
                <li>
                  <span className="step-time">1 approve</span>
                  <span className="step-body">
                    snippet picks them up on the next page load — control + variants, sticky per shopper
                  </span>
                </li>
                <li>
                  <span className="step-time">auto</span>
                  <span className="step-body">
                    thompson allocator re-weights every cycle · pins leader at <strong>≥95% confidence</strong> with ≥500 samples
                  </span>
                </li>
              </ol>

              <div className="resolve-foot">
                <span className="mono fine">zero slack threads · zero standups · zero figma comment storms</span>
                <button className="btn btn-lime">audit your store →</button>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Open-source proof — moved out of hero, given its own moment ---- */}
        <section className="os-section" data-reveal>
          <div className="shell">
            <div className="os-section-head">
              <div className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>built in the open</div>
              <h2 className="h-section" style={{ marginTop: 16 }}>
                You can <em>read every line.</em>
              </h2>
              <p className="lede" style={{ margin: "20px auto 0", textAlign: "center" }}>
                No black-box pricing, no locked-in dashboards. The audit prompts, the
                bandit math, the snippet — all in one repo, MIT-licensed.
              </p>
            </div>

            <div className="os-proof os-proof-center">
              <span className="lbl">100% open source</span>
              <GithubStars repo="codewithmuh/bandit" />
              <span className="badge lime">MIT</span>
              <span className="badge"><span className="key">self-hostable ·</span> docker compose up</span>
              <span className="badge"><span className="key">stack ·</span> next.js · django · postgres</span>
              <span className="stat">
                use <strong>your</strong> infra · <strong>your</strong> data · <strong>your</strong> claude key
              </span>
            </div>
          </div>
        </section>

        {/* ---- Open-source manifesto (replaces fake testimonial) ---- */}
        <section data-reveal>
          <div className="shell-tight">
            <div className="eyebrow">why open source</div>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              Growth tools should be <em>code</em>, not contracts.
            </h2>
            <p className="lede" style={{ marginTop: 22, fontSize: 17 }}>
              Closed-source CRO and personalization platforms charge $1k–$5k/mo and lock
              your shopper data + experiment history inside their dashboard. Cartlift ships
              the same engine — audits, variant generator, Thompson-sampled allocator, A/B
              snippet — under MIT license. Clone the repo. Run it on a $5 droplet. Bring
              your own Claude or OpenAI key. The orders and conversion data stay in your
              Postgres.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 36 }}>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 13, marginBottom: 10, letterSpacing: "0.06em" }}>$ git clone</div>
                <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", marginBottom: 8 }}>Self-host in 60 seconds</div>
                <p style={{ fontSize: 15, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Docker compose. Postgres + Django + Next.js. Runs on your laptop, your VPS, or your cluster.
                </p>
              </div>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 13, marginBottom: 10, letterSpacing: "0.06em" }}>$ paste key · pick model</div>
                <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", marginBottom: 8 }}>Bring your own LLM</div>
                <p style={{ fontSize: 15, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Paste a Claude or OpenAI key in <span className="mono">/dashboard/settings</span>. Pick the model. Per-user — keys never touch any other server.
                </p>
              </div>
              <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                <div className="mono" style={{ color: "var(--lime)", fontSize: 13, marginBottom: 10, letterSpacing: "0.06em" }}>$ fork → tune → ship</div>
                <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", marginBottom: 8 }}>Your prompts, your rules</div>
                <p style={{ fontSize: 15, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                  Edit the audit prompts, swap the bandit algorithm, fork the dashboard. It is all in one repo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section id="faq" data-reveal>
          <div className="shell-tight">
            <div className="eyebrow">faq</div>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              The <em>questions</em> store owners ask us most.
            </h2>

            <div className="faq">
              <details className="faq-row">
                <summary>How does cartlift actually change my store?</summary>
                <p>
                  A small JS snippet — about 3kb. Drop it in your Shopify theme, WooCommerce
                  header, BigCommerce script manager, or any headless front-end. It loads
                  asynchronously and only swaps the elements that match a variant&apos;s CSS
                  selector. The original page is the control; shoppers who get the variant
                  are routed by a Thompson-sampling allocator that re-weights as orders
                  come in.
                </p>
              </details>

              <details className="faq-row">
                <summary>Will this break my store or my checkout?</summary>
                <p>
                  The snippet wraps every DOM swap in a try/catch — if anything throws, the
                  original page renders untouched. Every experiment has approve / pause /
                  kill controls in the dashboard. The whole snippet is one template in
                  <span className="mono"> api/snippet/views.py</span> — read it before you
                  paste it. It never touches your checkout flow unless you point a variant
                  at it.
                </p>
              </details>

              <details className="faq-row">
                <summary>How do you decide what to test on my store?</summary>
                <p>
                  You paste a URL — a PDP, a collection, your homepage, your cart. Cartlift
                  fetches the live HTML and runs a CRO audit against it (Claude or OpenAI,
                  your key). Each finding — vague headline, low-contrast add-to-cart,
                  missing trust row, hidden return policy — comes back with a predicted
                  lift, and you click <em>generate variants</em> to turn the findings you
                  like into draft experiments. No telemetry, no session recordings — just
                  the page.
                </p>
              </details>

              <details className="faq-row">
                <summary>How long until I see lift on AOV or conversion?</summary>
                <p>
                  Depends on traffic. The allocator auto-pins a winner only after a variant
                  clears ≥500 samples with ≥95% posterior confidence and positive uplift
                  vs control. At ~10k weekly sessions, that is typically 5–7 days. Lower
                  traffic stores see longer trials. The allocator can run on cron, but you
                  can also trigger it manually from the dashboard or
                  <span className="mono"> manage.py allocate_bandits</span>.
                </p>
              </details>

              <details className="faq-row">
                <summary>What if I do not like a variant cartlift shipped?</summary>
                <p>
                  Open the experiment and hit <em>kill</em>. Status flips to killed, the
                  snippet stops serving the variant on its next refresh, and the original
                  control is what every shopper sees. There is no &quot;30-day suppression&quot;
                  magic — kill it, archive it, move on.
                </p>
              </details>

              <details className="faq-row">
                <summary>Is my store data shared with other customers?</summary>
                <p>
                  No. Audits, variants, experiments, and exposure / conversion samples all
                  live in your own Postgres (or our hosted Postgres scoped to your
                  workspace). No shared training data. The only network call leaving your
                  stack is the one to Anthropic or OpenAI with the key you set in
                  settings.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ---- Explainer ribbon — the 4-step loop, as a final recap ---- */}
        <section className="hero-flow" data-reveal aria-label="how cartlift works">
          <div className="shell">
            <div className="flow-head">
              <div className="eyebrow">the loop</div>
              <h3 className="flow-title">Audit → Draft → Ship → Win. <em>On repeat.</em></h3>
            </div>
            <div className="flow">
              <div className="flow-node">
                <div className="flow-num">step.01</div>
                <div className="flow-label">paste a url</div>
                <div className="flow-sub">your store, any page</div>
              </div>
              <div className="flow-arrow" aria-hidden="true" />
              <div className="flow-node">
                <div className="flow-num">step.02</div>
                <div className="flow-label">ai audits</div>
                <div className="flow-sub">~30s · 4 lenses</div>
              </div>
              <div className="flow-arrow" aria-hidden="true" />
              <div className="flow-node">
                <div className="flow-num">step.03</div>
                <div className="flow-label">drafts variants</div>
                <div className="flow-sub">one-click approve</div>
              </div>
              <div className="flow-arrow" aria-hidden="true" />
              <div className="flow-node win">
                <div className="flow-num">step.04</div>
                <div className="flow-label">ships the winner</div>
                <div className="flow-sub">thompson auto-pin</div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Footer CTA ---- */}
        <section data-reveal style={{ paddingBottom: 0 }}>
          <div className="shell-tight" style={{ textAlign: "center" }}>
            <h2 className="h-section">
              Run cartlift. <em>Keep the data.</em>
            </h2>
            <p className="lede" style={{ margin: "24px auto 32px" }}>
              Run a free annotated audit on the hosted plan, or clone the repo and self-host
              the whole stack. CRO · SEO · Trust · Shopping feed — same engine either way.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-lime">audit your store →</Link>
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
                    <span className="brand-mark">C</span>
                    cartlift
                  </div>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-3)", maxWidth: 320, lineHeight: 1.6 }}>
                    Open-source ecommerce CRO. A/B tests that pick themselves.
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
                <span>© 2026 Cartlift Labs · made in a terminal</span>
                <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <Link href="/privacy" style={{ color: "var(--ink-3)" }}>privacy</Link>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <Link href="/terms" style={{ color: "var(--ink-3)" }}>terms</Link>
                  <span style={{ color: "var(--ink-5)" }}>·</span>
                  <span style={{ color: "var(--lime)" }}>● cartlift · v0.1.0</span>
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
