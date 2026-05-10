# Bandit — Codebase Notes for Claude / Claude Code

> The CRO daemon. Open-source clone-and-build of [Sherpa](https://withsherpa.ai),
> styled as a developer-coded terminal product (dark mode, IBM Plex Mono accents,
> single lime accent). One repo, three runtimes: Next.js web · Django API ·
> Postgres database.

## Repo layout

```
bandit/
├── src/                   # Next.js 15 + React 19 (port 3050)
│   ├── app/               # App Router routes
│   │   ├── page.tsx       # Marketing landing (10 sections)
│   │   ├── signin/        # Email + password sign in
│   │   ├── signup/        # Email + password sign up
│   │   └── dashboard/     # Authenticated workspace
│   │       ├── layout.tsx     # Sidebar + main shell
│   │       ├── Sidebar.tsx    # Loads /api/auth/me; auto-redirects to /signin
│   │       ├── page.tsx       # Overview
│   │       ├── audits/        # Run + list audits
│   │       ├── sites/         # Register sites + grab snippet token
│   │       ├── experiments/   # List experiments / variants
│   │       └── settings/      # Edit company name
│   └── lib/api.ts         # Typed fetch wrapper. JWT in localStorage.
│
├── api/                   # Django 5.1 + DRF + JWT (port 8050)
│   ├── manage.py
│   ├── conf/              # settings.py, urls.py, wsgi.py
│   ├── accounts/          # Custom User (email login). JWT issuance.
│   ├── sites/             # Customer-owned sites + snippet tokens
│   ├── experiments/       # Experiment, Variant, Sample (event log)
│   ├── audits/            # Audit model + runner.py (Claude-backed pipeline)
│   ├── Dockerfile
│   ├── entrypoint.sh      # Wait for db → makemigrations → migrate → collectstatic → gunicorn
│   └── requirements.txt
│
├── docker-compose.yml     # db (postgres:16-alpine, port 5450) + api (port 8050)
├── .env.example           # All env vars (incl. ANTHROPIC_API_KEY for the audit pipeline)
└── package.json           # Next.js dev/build scripts
```

## Dev quickstart

```bash
# 1. Backend + database
cp .env.example .env       # optional: paste ANTHROPIC_API_KEY for real audits
docker compose up -d --build

# 2. Frontend
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

All endpoints under `/api/`. JWT bearer token in `Authorization` header, except signup/login.

```
GET  /api/health                     # public
POST /api/auth/signup                # email + password (+ company optional)
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me     PATCH /api/auth/me

GET  /api/sites/      POST /api/sites/      DELETE /api/sites/{id}/
  → returns Site with auto-generated snippet token (`bnd_xxxx`)

POST /api/audits/     # body: {"url": "..."}  — runs the audit synchronously
GET  /api/audits/                    # list user's audits

GET  /api/experiments/               # list (read-only for now; bandit drafts via worker)
```

## The audit pipeline (`api/audits/runner.py`)

This is the core "we own it" piece. Sequence:

1. `_fetch_text(url)` — `requests.get()` with our UA. Strips scripts/styles, collapses HTML to ~8K chars of visible text. Extracts `<title>`.
2. `_claude_findings(url, title, text)` — POSTs to Anthropic Messages API with a CRO-consultant system prompt asking for 3-5 structured findings. Pulls the first JSON array out of the response.
3. **Fallback:** if `ANTHROPIC_API_KEY` is unset OR the call fails, returns a hand-written `_CANNED` list. This means the demo always works, even offline.
4. Returns `{status, page_title, summary, findings[], elapsed_ms}` which the view persists on the `Audit` row.

The runner is sync. For prod scale push to Celery / Trigger.dev — the surface is already a single function call, easy to swap.

## Auth flow (web ↔ api)

1. Sign up at `/signup` → POST `/api/auth/signup` → DRF returns `{access, refresh, user}`.
2. `writeTokens()` puts both in `localStorage` and dispatches a `bandit-auth` event.
3. Every subsequent `api()` call attaches `Authorization: Bearer <access>`.
4. The dashboard `Sidebar` calls `auth.me()` on mount; on 401/403 it `clearTokens()` and redirects to `/signin`.

JWT lifetimes are in `conf/settings.py::SIMPLE_JWT` — 60 min access, 14 day refresh.

## Brand + style notes

- **Single accent:** `--lime: #4ade80`. Use it ONLY for uplift / winning / live data. Never for nav/UI chrome — that breaks the visual semantic of "lime = profit."
- **Mono everywhere it counts:** `JetBrains Mono` for nav links, buttons, tags, fine print, numbers. Sans (Inter) only for prose paragraphs and h1/h2 display.
- **Punctuation in copy:** lowercase nav, lowercase fine print, lowercase tags. Sentence-case in body prose. Capital "Bandit" only inside sentences.
- **Eyebrows** use a pulsing lime dot (`::before` + `@keyframes pulse`). Don't reach for emoji.
- **Buttons:** `border-radius: 4px`. Pill is forbidden — looks too SaaS, breaks the terminal aesthetic.
- **Backgrounds:** flat `#0a0a0a` + a 24px dot grid + a 3.5%-opacity SVG film grain overlay. No CSS gradients on body — they band.

## Common Claude Code tasks (with the right files)

| If the user asks… | Touch these files |
|---|---|
| "wire the audit endpoint to a real ASR / different LLM" | `api/audits/runner.py` (only) |
| "add a new dashboard route" | `src/app/dashboard/<name>/page.tsx` + add link in `src/app/dashboard/Sidebar.tsx::ITEMS` |
| "add a new model" | `api/<app>/models.py` → run `docker compose exec api python manage.py makemigrations` |
| "expose a new endpoint" | `api/<app>/views.py` (DRF ViewSet) + `api/<app>/urls.py` (DefaultRouter) + register in `api/conf/urls.py` |
| "change look/feel" | `src/app/globals.css` — single source of truth, no per-component CSS files |
| "add JS snippet for site instrumentation" | New `api/snippet/` Django app + serve a static `/snippet.js` that POSTs to `/api/sites/{token}/sample/` |

## What's NOT implemented yet

These are the obvious next builds (each is 2-6 hours):

1. **JS snippet endpoint** — `api/snippet/` app that serves `/s/<token>.js` and accepts `POST /s/<token>/sample/` for expose/convert events.
2. **Bandit allocator** — a periodic job that updates `Variant.weight` based on `samples / conversions` (Thompson sampling or epsilon-greedy).
3. **Variant generator worker** — calls Claude with the audit findings + current page HTML; emits `Variant` rows with `body` + `rationale`.
4. **Approval flow** — UI to approve/reject draft variants before they go live.
5. **Per-experiment view** — drill-down page at `/dashboard/experiments/[id]` with the conversion chart + variant comparison.

## Ports + container names (for `docker compose` operations)

| | port | container |
|---|---|---|
| postgres | 5450 → 5432 | `bandit-db-1` |
| django api | 8050 → 8000 | `bandit-api-1` |

```bash
docker compose logs api --tail 50
docker compose exec api python manage.py shell
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
