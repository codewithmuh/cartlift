# cartlift

> **Lift every cart. Open-source.**
>
> The ecommerce growth daemon. Audits any store URL for **conversion · seo · trust · google merchant**, drafts page variants, ships them behind a JS snippet, and lets a multi-armed bandit allocate traffic to whatever wins.

```
┌─ cartlift ───────────────────────────────────────────────────────────┐
│  audit  →  draft  →  approve  →  ship  →  allocate  →  auto-ship    │
└──────────────────────────────────────────────────────────────────────┘
```

Built in public by [@codewithmuh](https://www.youtube.com/@codewithmuh) as a buildable open-source alternative to closed CRO platforms (VWO, Optimizely, Convert.com). Designed for ecommerce — Shopify, WooCommerce, BigCommerce, headless. MIT licensed — clone it, fork it, sell it.

---

## What it does

| Audit | What it finds | Output |
|---|---|---|
| **Conversion** | PDP / cart / checkout friction, hero copy, add-to-cart contrast, social proof above the fold, mobile-fold cutoff | 3-5 short findings · predicted lift % per finding · drafted page variants |
| **SEO** | Title / meta / Product schema / H1 hierarchy / render-blocking resources / per-page diagnostics | scored A-F report · 4-6 prioritised findings · severity per finding |
| **Trust & policy** | Privacy + terms + returns alignment, contact identity, payment-method visibility, checkout transparency | long-form report · 14-item checklist · 6 sections + recommendations + conclusion |
| **Google Merchant** | GMC suspension audit — misrepresentation, prohibited content, shipping/returns alignment | GMC-grade report · diagnostics table + account areas + website checks + sections + conclusion |

After the audit, the daemon can:

1. **Draft variants** — turn each conversion / SEO finding into 2-3 candidate page variants (Claude or canned fallback)
2. **A/B them** — your store loads `<script async src="…/s/<token>.js">`, the snippet picks variants per shopper, fires `expose` + `convert` events
3. **Allocate** — run `python manage.py allocate_bandits` (or cron it) and Thompson sampling re-weights traffic toward winners
4. **Auto-ship** — when the leader has ≥500 samples + ≥95% posterior confidence, the experiment is pinned 100% to the winner and marked `winner`

The whole loop is in this repo. Nothing is hand-waved.

---

## Public audit bundles

A single submission on the marketing site (`POST /api/public/audits/`) creates **all four audits in parallel** and returns one shareable bundle slug. The `/audit/<group_slug>` page renders four tabs — conversion / seo / trust / google merchant — **all free to view, no login**. Email is only required to **download a PDF** of the report.

```
POST /api/public/audits/               → { group_slug, audits: { cro, seo, compliance, gmc } }
GET  /api/public/audits/<group_slug>/  → same payload (cached + revalidated)
POST /api/public/audits/<group_slug>/download/  body: {email}   → captures lead, returns bundle
POST /api/public/audits/<group_slug>/claim/                     → attach whole bundle to current user (JWT)
```

---

## Stack

- **Web** — Next.js 15 · React 19 · App Router · TypeScript · single `globals.css`
- **API** — Django 5.1 · DRF · SimpleJWT · psycopg 3 · Postgres 16
- **AI** — Anthropic Claude (audit pipeline + variant drafts) — server-side only, BYO key
- **Infra** — Docker Compose for `db` + `api`. Web runs on the host.

No CSS framework, no state library, no ORM other than Django's. One repo, three runtimes.

---

## Quickstart

```bash
git clone https://github.com/codewithmuh/cartlift.git
cd cartlift

# 1. backend + database (Django + Postgres in Docker)
cp .env.example .env                 # optional: paste ANTHROPIC_API_KEY
docker compose up -d --build         # api :8050 · postgres :5450

# 2. frontend (Next.js on the host)
cd web
npm install
npm run dev                          # http://localhost:3050
```

Paste a store URL into the hero on the landing page → ~30 seconds later you have four reports across four tabs. Sign up at [`/signup`](http://localhost:3050/signup) to claim the bundle into a dashboard, generate page variants, and run live A/B tests.

> **No Claude key?** Every audit type returns a deterministic canned report so the demo flow always works. Useful on planes and during interviews.

---

## Ports

| service | url |
|---|---|
| **web** (Next.js) | http://localhost:3050 |
| **api** (Django + Gunicorn) | http://localhost:8050 |
| **django admin** | http://localhost:8050/admin · `admin@cartlift.dev` / `cartlift_admin_dev` |
| **postgres** | `localhost:5450` (user `cartlift`, db `cartlift`, pw `cartlift_dev`) |

---

## Repo layout

Standard monorepo split: `web/` (Next.js) + `api/` (Django) + `docker-compose.yml` at the root.

```
cartlift/
├── web/                       # Next.js 15 — marketing + dashboard (port 3050)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # landing (hero · k-beauty mock · audits grid · how · dashboard mock · POV · OS manifesto · FAQ · 4-step recap)
│   │   │   ├── audit/[slug]/      # public 4-tab bundle viewer (free, no login) + PDF email gate
│   │   │   ├── signin/  signup/   # JWT auth (signup is bundle-aware via ?claim=<group_slug>)
│   │   │   └── dashboard/         # AuditBar header + 4 routes:
│   │   │       ├── audits/        #   list + tabs + auto-run
│   │   │       ├── audits/[id]/   #   per-audit report (download .md / .json / pdf via window.print)
│   │   │       ├── sites/         #   register stores + copy install snippet
│   │   │       ├── experiments/   #   list + drill-down + approve/kill/pause
│   │   │       └── settings/      #   account
│   │   └── lib/api.ts             # typed fetch wrapper · JWT in localStorage
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.mjs
│
├── api/                       # Django 5.1 + DRF (port 8050)
│   ├── conf/                  # settings · urls · wsgi
│   ├── accounts/              # custom email-login user · JWT issuance
│   ├── sites/                 # customer stores + bnd_xxx snippet tokens (legacy prefix preserved)
│   ├── experiments/           # Experiment · Variant · Sample
│   │   └── management/commands/allocate_bandits.py
│   ├── audits/                # Audit + AuditLead models · runner.py (parallel) · generator.py
│   │   ├── public_views.py    # 4-audit bundles + email-gated PDF download
│   │   └── runner.py          # run_audit() + run_audits_bundle() (threaded)
│   └── snippet/               # public, no-auth: /s/<token>.js + /active + /expose + /convert
│
├── docker-compose.yml         # postgres + api
├── .env.example
├── README.md
├── CLAUDE.md                  # architecture notes for Claude Code sessions
└── LICENSE                    # MIT
```

---

## API surface

### Public — no JWT, lets visitors share full bundles

```
GET   /api/health                                       public
POST  /api/public/audits/                               body: {"url"} → 4-audit bundle
GET   /api/public/audits/<group_slug>/                  → bundle payload
POST  /api/public/audits/<group_slug>/download/         body: {"email"} → captures lead, returns bundle
POST  /api/public/audits/<group_slug>/claim/            (JWT) attach whole bundle to current user
```

### Authenticated (JWT bearer)

```
POST  /api/auth/signup                           email + password (+ company)
POST  /api/auth/login
POST  /api/auth/refresh
GET   /api/auth/me      PATCH /api/auth/me

GET   /api/sites/       POST /api/sites/         DELETE /api/sites/{id}/
POST  /api/audits/                               body: {"url", "audit_type"}
GET   /api/audits/?type=cro|seo|compliance|gmc   filter by type
GET   /api/audits/{id}/
POST  /api/audits/{id}/generate_variants/        body: {"site_id"}
GET   /api/experiments/                          list
GET   /api/experiments/{id}/                     drill-down
POST  /api/experiments/{id}/approve/             draft → trial
POST  /api/experiments/{id}/pause/
POST  /api/experiments/{id}/kill/
GET   /api/experiments/variants/                 read-only
```

### Public — the snippet (CORS open, no JWT, scoped by token in URL)

```
GET   /s/<token>.js                              ~3 KB JS for customer stores
GET   /s/<token>/active                          JSON of active experiments + variants
POST  /s/<token>/expose                          {"variant_id", "visitor"}
POST  /s/<token>/convert                         {"variant_id", "visitor"}
```

---

## The audit pipeline

`api/audits/runner.py` — the "we own it" piece. Sequence:

1. **Fetch** the URL with our UA, strip scripts/styles, collapse to ~8K chars of visible text, extract `<title>`.
2. **Prompt** Claude with a type-specific consultant prompt (conversion / SEO / trust / GMC). Pull the first JSON block out of the response.
3. **Fallback** — if `ANTHROPIC_API_KEY` is unset OR the call fails, return a hand-written canned report. The demo never breaks.
4. **Persist** `{status, page_title, summary, findings[], report{}, elapsed_ms}` on the `Audit` row.

`run_audits_bundle(url, ["cro","seo","compliance","gmc"])` fans out via a `ThreadPoolExecutor` — four parallel I/O-bound LLM calls finish in roughly the time of one.

Sync request handler. For prod scale, push the runner to Celery / Trigger.dev — the surface is a single function call.

---

## The variant generator

`api/audits/generator.py` — turns a conversion / SEO audit's findings into draft Experiments + Variants on a chosen Site.

For each finding:
- 1 control Variant (empty body, never applied)
- 2-3 candidate Variants drafted by Claude (or canned per-surface fallback)
- Experiment in `draft` status with the finding's `predicted_lift_pct` as the target uplift

User reviews, clicks **approve**, status flips to `trial`, and the snippet picks them up on next page load.

---

## The bandit allocator

`api/experiments/management/commands/allocate_bandits.py` — Thompson sampling, stdlib only.

```bash
docker compose exec api python manage.py allocate_bandits
docker compose exec api python manage.py allocate_bandits --experiment 12 --draws 10000
```

For each `trial` experiment:
1. Treat each Variant as a `Beta(α=conversions+1, β=samples-conversions+1)` arm
2. Sample 5000 times; arm's new weight = fraction of samples it won
3. If a non-control leader has ≥500 samples + ≥95% posterior confidence + positive uplift, **auto-ship** — pin weights 100/0 and flip the experiment to `winner`

Run it on a cron / Trigger.dev schedule (every 30-60 min in prod).

---

## The snippet (~3 KB, what stores paste in their `<head>`)

```html
<script async src="https://your-cartlift-instance.example.com/s/bnd_xxx.js"></script>
```

```js
// fire conversions from anywhere on the store page:
window.bandit && window.bandit.convert(experimentId);
```

> The global is `window.bandit` and snippet tokens are `bnd_xxx` — both kept stable from the original brand so installed snippets don't break. The customer-facing API isn't versioned by brand name.

What it does:

- Picks a stable variant per shopper (sticky via `localStorage`)
- Swaps DOM via the experiment's CSS selector (`h1` for `hero_headline`, etc.)
- Fires `expose` on load via `navigator.sendBeacon`
- Exposes `window.bandit.convert(experimentId)` — call it on a button click / form submit
- Circuit breaker — if anything throws, the original store page renders untouched. We don't break the host.

---

## Auth flow

1. `/signup` → `POST /api/auth/signup` → returns `{access, refresh, user}`
2. `writeTokens()` puts both in `localStorage` and dispatches a `bandit-auth` event (internal, kept stable from the original brand)
3. Every `api()` call attaches `Authorization: Bearer <access>`
4. `Sidebar` calls `auth.me()` on mount — on 401/403, `clearTokens()` and redirect to `/signin`

JWT lifetimes in `conf/settings.py::SIMPLE_JWT` — 60 min access, 14 day refresh.

---

## Development

```bash
# tail api logs
docker compose logs api --tail 50 -f

# django shell
docker compose exec api python manage.py shell

# psql
docker compose exec db psql -U cartlift

# new migration after editing api/<app>/models.py
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate

# run the bandit allocator manually
docker compose exec api python manage.py allocate_bandits
```

---

## Conventions

- Single `globals.css`. No Tailwind, no CSS-in-JS.
- Local component state + `localStorage`. No Redux / Zustand / Jotai.
- Email + password JWT. No OAuth providers unless asked.
- Django ORM only.
- Every fetch goes through `src/lib/api.ts::api()`.
- Coral (`#c2410c` text · `#fb923c` glows) is reserved for uplift / live / winning data — never UI chrome.
- `border-radius: 4px` on buttons. No pills.
- No emoji in code or UI.
- `ANTHROPIC_API_KEY` stays server-side. Never bundles, never payloads.
- Lowercase nav copy. Sentence-case in body prose.

---

## Built by codewithmuh

This repo ships alongside a YouTube build series. If it helps, drop a star + subscribe — that's how I know to build the next one.

- **YouTube** — [@codewithmuh](https://www.youtube.com/@codewithmuh) (build videos)
- **GitHub** — [github.com/codewithmuh](https://github.com/codewithmuh)
- **LinkedIn** — [linkedin.com/in/muhammad-rashid-daha](https://linkedin.com/in/muhammad-rashid-daha)
- **X** — [@codewithmuh](https://x.com/codewithmuh)
- **Email** — `contact@codewithmuh.com`

---

## License

MIT — fork it, brand it, deploy it for clients. See [LICENSE](LICENSE).
