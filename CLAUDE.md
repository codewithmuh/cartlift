# Bandit — Codebase Notes for Claude / Claude Code

> **Convert more visitors. Open-source.** The CRO daemon — audits any URL for CRO / SEO / Compliance / Google Merchant, drafts page variants, ships them via a JS snippet, and runs Thompson-sampled A/B tests that auto-pin winners.
>
> Built in public by [@codewithmuh](https://www.youtube.com/@codewithmuh). MIT licensed. One repo, three runtimes (Next.js web · Django API · Postgres). Single `globals.css`, no Tailwind, no state library, no ORM other than Django's.

## Repo layout

Standard monorepo: `web/` (Next.js) + `api/` (Django) + `docker-compose.yml` at the root.

```
bandit/
├── web/                       # Next.js 15 + React 19 (port 3050)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Marketing landing
│   │   │   ├── globals.css             # SINGLE source of truth — light theme + lime accent
│   │   │   ├── layout.tsx
│   │   │   ├── URLAuditInput.tsx       # Hero URL input that pushes to /signup?audit=URL
│   │   │   ├── signin/                 # JWT signin
│   │   │   ├── signup/                 # Audit-aware signup (?audit=URL → preview + claim)
│   │   │   │   ├── SignupCanvas.tsx        # Left panel: "your audit is queued" preview
│   │   │   │   └── SignupForm.tsx
│   │   │   └── dashboard/              # Authenticated workspace
│   │   │       ├── layout.tsx              # Sidebar + sticky AuditBar wrapper
│   │   │       ├── Sidebar.tsx             # Loads /api/auth/me; redirects to /signin on 401
│   │   │       ├── AuditBar.tsx            # Sticky URL+type bar at top of EVERY dashboard page
│   │   │       ├── page.tsx                # Overview
│   │   │       ├── audits/
│   │   │       │   ├── page.tsx → AuditsView.tsx     # Tabs + auto-run from ?run=
│   │   │       │   └── [id]/                          # Per-audit detail
│   │   │       │       ├── page.tsx
│   │   │       │       └── AuditDetailView.tsx       # Short-form (CRO/SEO) or long-form (Compliance/GMC)
│   │   │       │                                     # + [→ generate variants] + .md/.json/PDF download
│   │   │       ├── sites/                  # Register sites + copy install snippet
│   │   │       ├── experiments/
│   │   │       │   ├── page.tsx → ExperimentsView.tsx   # List with status pills
│   │   │       │   └── [id]/                            # Drill-down
│   │   │       │       ├── page.tsx
│   │   │       │       └── ExperimentDetailView.tsx     # Variant table + weight bars
│   │   │       │                                        # + approve/pause/kill + 8s polling
│   │   │       └── settings/               # Edit company name
│   │   └── lib/api.ts                  # Typed fetch wrapper. JWT in localStorage.
│   ├── package.json                    # next dev/build scripts
│   ├── tsconfig.json
│   └── next.config.mjs
│
├── api/                       # Django 5.1 + DRF + JWT (port 8050)
│   ├── manage.py
│   ├── conf/                       # settings.py · urls.py · wsgi.py
│   ├── accounts/                   # Custom email-login User. JWT issuance.
│   ├── sites/                      # Site model + auto-generated bnd_xxx token
│   ├── experiments/                # Experiment · Variant · Sample
│   │   ├── views.py                    # ViewSet + approve/kill/pause actions
│   │   └── management/commands/allocate_bandits.py   # Thompson sampling
│   ├── audits/                     # Audit + runner.py + generator.py
│   │   ├── runner.py                   # 4-type Claude pipeline w/ canned fallback
│   │   └── generator.py                # Audit findings → draft Experiment + Variants
│   ├── snippet/                    # PUBLIC, no-JWT routes for the customer-side snippet
│   │   └── views.py                    # /s/<token>.js · /active · /expose · /convert
│   ├── Dockerfile
│   ├── entrypoint.sh               # Wait for db → makemigrations → migrate → collectstatic → gunicorn
│   └── requirements.txt
│
├── docker-compose.yml         # postgres:16-alpine (port 5450) + django api (port 8050)
├── .env.example               # All env vars (incl. ANTHROPIC_API_KEY for the audit pipeline)
├── README.md                  # Public-facing
├── CLAUDE.md                  # this file
└── LICENSE                    # MIT
```

## Dev quickstart

```bash
# 1. Backend + database (Django + Postgres in Docker)
cp .env.example .env       # optional: paste ANTHROPIC_API_KEY for real audits
docker compose up -d --build

# 2. Frontend (Next.js on the host)
cd web
npm install
npm run dev                # → http://localhost:3050
```

| Service | URL |
|---|---|
| Web (Next.js) | http://localhost:3050 |
| API (Django + Gunicorn) | http://localhost:8050 |
| Django admin | http://localhost:8050/admin · `admin@bandit.dev` / `bandit_admin_dev` |
| Postgres | localhost:5450 |

## API surface

All routes under `/api/` need JWT bearer. The snippet routes under `/s/` are public (CORS open, scoped by token in URL).

```
GET  /api/health                     public

POST /api/auth/signup
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me     PATCH /api/auth/me

GET  /api/sites/      POST /api/sites/      DELETE /api/sites/{id}/
  → returns Site with auto-generated snippet token (`bnd_xxxx`)

POST /api/audits/                                 body: {url, audit_type}
GET  /api/audits/?type=cro|seo|compliance|gmc     filter by type
GET  /api/audits/{id}/
POST /api/audits/{id}/generate_variants/          body: {site_id}
                                                  → creates draft Experiments + Variants

GET  /api/experiments/                            list
GET  /api/experiments/{id}/                       drill-down with all variants
POST /api/experiments/{id}/approve/               draft|paused → trial
POST /api/experiments/{id}/pause/                 trial → paused
POST /api/experiments/{id}/kill/                  trial|paused → killed
GET  /api/experiments/variants/                   read-only

GET  /s/<token>.js                                ~3 KB JS for customer sites
GET  /s/<token>/active                            JSON of active experiments + variants
POST /s/<token>/expose                            {variant_id, visitor}
POST /s/<token>/convert                           {variant_id, visitor}
```

## The four audit types

| Type | Output shape | Where to look |
|---|---|---|
| `cro` | `findings[]` with `surface · severity · label · note · predicted_lift_pct` | `runner.py::_PROMPT_CRO`, fallback `_CRO_CANNED` |
| `seo` | `findings[]` with same shape, `predicted_lift_pct: 0` | `_PROMPT_SEO`, `_SEO_CANNED` |
| `compliance` | `report{checks[], sections[], conclusion[]}` (long-form) | `_PROMPT_COMPLIANCE`, `_COMPLIANCE_REPORT` |
| `gmc` | `report{messages[], areas[], checks[], sections[], conclusion[]}` (Yoonlab-style) | `_PROMPT_GMC`, `_GMC_REPORT` |

If `ANTHROPIC_API_KEY` is unset or the call fails, the runner returns the `_CANNED` fallback for that type. **The demo flow always works**, even offline.

## The full daemon loop

```
audit any URL  →  pick a type
        ↓
findings (cro/seo) OR report (compliance/gmc)
        ↓
[→ generate variants]   (only on cro/seo)
        ↓
draft Experiments + Variants on a chosen Site
        ↓
[approve]   → status="trial"
        ↓
GET /s/<token>/active   ← customer's snippet polls
        ↓
snippet picks a variant per visitor (sticky via localStorage)
        ↓
applies via CSS selector + fires `expose`
        ↓
visitor converts → window.bandit.convert(experimentId)
        ↓
Sample rows pile up in Postgres
        ↓
python manage.py allocate_bandits   (cron / Trigger.dev every 30 min)
        ↓
Thompson sampling re-weights variants
        ↓
leader with ≥500 samples + ≥95% confidence + positive uplift
        ↓
auto-ship: weights pinned 100/0, status="winner"
```

## Auth flow (web ↔ api)

1. Sign up at `/signup` → `POST /api/auth/signup` → DRF returns `{access, refresh, user}`.
2. `writeTokens()` puts both in `localStorage` and dispatches a `bandit-auth` event.
3. Every subsequent `api()` call attaches `Authorization: Bearer <access>`.
4. `Sidebar` calls `auth.me()` on mount; on 401/403 it `clearTokens()` and redirects to `/signin`.

JWT lifetimes in `conf/settings.py::SIMPLE_JWT` — 60 min access, 14 day refresh.

If the user landed via `/signup?audit=URL`, the signup canvas shows a "your audit is queued" preview. After successful signup, they're redirected to `/dashboard/audits?run=<URL>&type=cro` which auto-fires the audit.

## Brand + style notes

- **Theme:** light. Warm cream bg `#fafaf7`, dark ink `#0c0c0c`, sharp 4px corners. Two surfaces (`dash-mock` and `auth-canvas .sample`) intentionally stay dark — embedded "terminal screenshots" on the otherwise light page (Stripe-docs / Linear-blog trick).
- **Single accent:** `--lime: #15803d` (text + CTAs, accessible) + `--lime-bright: #4ade80` (glows + soft fills). Reserved for uplift / winning / live data. Never UI chrome.
- **Mono everywhere it counts:** `JetBrains Mono` for nav, buttons, tags, fine print, numbers. Sans (`Inter`) only for prose paragraphs and h1/h2.
- **Punctuation:** lowercase nav, lowercase fine print, lowercase tags. Sentence-case in body prose. Capital "Bandit" only inside sentences.
- **Eyebrows** use a pulsing lime dot (`::before` + `@keyframes pulse`). No emoji.
- **Buttons:** `border-radius: 4px`. Pills are forbidden — too SaaS, breaks the terminal aesthetic.
- **Backgrounds:** flat `#fafaf7` + 24px dark dot grid + 4%-opacity SVG film grain via `body::after` (multiply blend). No CSS gradients on body — they band.
- **`text-wrap: balance`** on `.h-display` so the headline never wraps to 3 lines on narrow viewports.

## Common Claude Code tasks

| If the user asks… | Touch these files |
|---|---|
| "wire the audit endpoint to a different LLM provider" | `api/audits/runner.py` only — replace `_claude()` with whichever provider |
| "add a new audit type" | `api/audits/models.py` (AUDIT_TYPES) → `runner.py` (add `_PROMPT_X` + `_X_CANNED`) → frontend `AuditsView.tsx` (add tab) + `AuditDetailView.tsx` (add long-form rendering if needed) |
| "add a new dashboard route" | `src/app/dashboard/<name>/page.tsx` + add link in `Sidebar.tsx::ITEMS` |
| "add a new model" | `api/<app>/models.py` → restart api (entrypoint runs `makemigrations` + `migrate`) |
| "expose a new endpoint" | `api/<app>/views.py` (DRF ViewSet) + `api/<app>/urls.py` + register in `api/conf/urls.py` |
| "change look/feel" | `src/app/globals.css` — single source of truth, no per-component CSS files |
| "add a new bandit algorithm (epsilon-greedy, UCB1)" | `api/experiments/management/commands/allocate_bandits.py::_allocate()` — swap the Beta/Thompson math |
| "make the snippet smaller" | `api/snippet/views.py::_SNIPPET_TEMPLATE` — currently ~3 KB |

## Ports + container names

| | port | container |
|---|---|---|
| postgres | 5450 → 5432 | `bandit-db-1` |
| django api | 8050 → 8000 | `bandit-api-1` |

```bash
docker compose logs api --tail 50 -f
docker compose exec api python manage.py shell
docker compose exec api python manage.py allocate_bandits
docker compose exec db psql -U bandit
```

## Conventions Claude should follow when editing this repo

- **Don't add a CSS framework.** Single `globals.css` is intentional.
- **Don't add a state library** (Redux/Zustand/etc.). Local component state + `localStorage` is sufficient.
- **Don't add OAuth providers** unless explicitly asked. Email + password JWT is the design.
- **Don't add an ORM other than the Django ORM.**
- **Use the existing api wrapper (`src/lib/api.ts::api()`) for every fetch.** Don't hand-roll fetches in components.
- **No emoji in code or UI** unless the user asks. The terminal aesthetic depends on its absence.
- **Keep the Anthropic call server-side only.** The `ANTHROPIC_API_KEY` env var must never appear in any frontend bundle, public env, or response payload.
- **Lowercase nav + tags + fine print.** Sentence-case body prose only.
- **Codewithmuh handles** — when adding social / contact links, use:
  - GitHub: `https://github.com/codewithmuh/bandit`
  - YouTube: `https://www.youtube.com/@codewithmuh`
  - LinkedIn: `https://linkedin.com/in/muhammad-rashid-daha`
  - X: `https://x.com/codewithmuh`
  - Email: `contact@codewithmuh.com`

## What's NOT implemented yet

These are the obvious next builds:

1. **Periodic allocator** — cron / Trigger.dev job that runs `allocate_bandits` every 30 min so weights update without manual intervention.
2. **Dashboard activity feed** — real-time list of recent `expose` / `convert` events on a site (debug surface for new customers).
3. **Conversion chart on experiment detail** — a real time-series of conversion rate per variant (currently shows latest stats only).
4. **Stripe billing** — for the hosted plan tier.
5. **Per-experiment weight history** — store snapshots so the dashboard can chart how weights migrated over time.
