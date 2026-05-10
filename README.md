# bandit

> The CRO daemon. A/B tests that pick themselves.

Bandit audits a landing page, drafts variant copy, ships it behind a snippet,
and lets a multi-armed bandit allocate traffic to whatever is winning. Built
as a developer-coded terminal product — dark mode, mono type, single lime
accent for live data.

```
┌─ bandit ──────────────────────────────────────────────┐
│  audit  →  draft  →  ship  →  allocate  →  learn      │
└───────────────────────────────────────────────────────┘
```

## Stack

- **Web** — Next.js 15 · React 19 · App Router · TypeScript
- **API** — Django 5.1 · DRF · SimpleJWT · Postgres 16
- **AI** — Anthropic Claude (audit pipeline, variant drafts)
- **Infra** — Docker Compose for db + api; Next runs on the host

One repo, three runtimes. No CSS framework, no state library — just
`globals.css` and `localStorage`.

## Quickstart

```bash
git clone <this repo> bandit && cd bandit

# 1. backend + database
cp .env.example .env                  # optional: paste ANTHROPIC_API_KEY
docker compose up -d --build          # api :8050  ·  postgres :5450

# 2. frontend
npm install
npm run dev                           # http://localhost:3050
```

Sign up at `/signup`, paste any URL into the audit field, and you're in.
Without a Claude key the runner returns a deterministic findings list, so
the demo flow always works — useful on planes and during interviews.

## Ports

| service | url |
|---|---|
| web (Next.js) | http://localhost:3050 |
| api (Django + Gunicorn) | http://localhost:8050 |
| django admin | http://localhost:8050/admin · `admin@bandit.dev` / `bandit_admin_dev` |
| postgres | localhost:5450 |

## Repo layout

```
bandit/
├── src/                   # Next.js — marketing + dashboard
│   ├── app/
│   │   ├── page.tsx       # 10-section landing
│   │   ├── signin/  signup/
│   │   └── dashboard/     # audits · sites · experiments · settings
│   └── lib/api.ts         # typed fetch wrapper · JWT in localStorage
│
├── api/                   # Django + DRF
│   ├── conf/              # settings · urls · wsgi
│   ├── accounts/          # custom email-login user · JWT issuance
│   ├── sites/             # customer sites + snippet tokens (bnd_xxxx)
│   ├── experiments/       # Experiment · Variant · Sample event log
│   └── audits/            # Audit model + runner.py (Claude pipeline)
│
├── docker-compose.yml     # postgres + api
└── CLAUDE.md              # full architecture notes
```

## API surface

All routes under `/api/`. JWT bearer token in `Authorization`, except auth.

```
GET   /api/health                 public

POST  /api/auth/signup            email + password (+ company)
POST  /api/auth/login
POST  /api/auth/refresh
GET   /api/auth/me      PATCH /api/auth/me

GET   /api/sites/       POST /api/sites/       DELETE /api/sites/{id}/
POST  /api/audits/      body: {"url": "..."}   — runs synchronously
GET   /api/audits/
GET   /api/experiments/
```

## The audit pipeline

The "we own it" piece. `api/audits/runner.py`:

1. **Fetch** the URL with our UA, strip scripts/styles, collapse to ~8K
   chars of visible text, extract `<title>`.
2. **Prompt** Claude with a CRO-consultant system prompt asking for 3-5
   structured findings. Pull the first JSON array out of the response.
3. **Fallback** — if `ANTHROPIC_API_KEY` is unset or the call fails,
   return a hand-written canned list. Demo never breaks.
4. **Persist** `{status, page_title, summary, findings[], elapsed_ms}` on
   the `Audit` row.

The runner is sync. For prod scale push it to Celery / Trigger.dev — the
surface is a single function call, easy to swap.

## Auth flow

1. `/signup` → `POST /api/auth/signup` → DRF returns `{access, refresh, user}`.
2. `writeTokens()` stores both in `localStorage` and dispatches a
   `bandit-auth` event.
3. Every `api()` call attaches `Authorization: Bearer <access>`.
4. The dashboard sidebar calls `auth.me()` on mount; on 401/403 it
   `clearTokens()` and redirects to `/signin`.

JWT lifetimes live in `conf/settings.py::SIMPLE_JWT` — 60 min access,
14 day refresh.

## Roadmap

These are obvious next builds, each 2-6 hours of work:

- [ ] **JS snippet endpoint** — `api/snippet/` app serves `/s/<token>.js`
      and accepts `POST /s/<token>/sample/` for expose/convert events.
- [ ] **Bandit allocator** — periodic job updates `Variant.weight` based
      on samples / conversions (Thompson sampling or epsilon-greedy).
- [ ] **Variant generator worker** — calls Claude with audit findings +
      page HTML, emits `Variant` rows with `body` + `rationale`.
- [ ] **Approval flow** — UI to approve / reject draft variants before
      they go live.
- [ ] **Per-experiment view** — `/dashboard/experiments/[id]` with the
      conversion chart + variant comparison.

## Development

```bash
# logs
docker compose logs api --tail 50 -f

# django shell
docker compose exec api python manage.py shell

# psql
docker compose exec db psql -U bandit

# new migration after editing api/<app>/models.py
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate
```

## Conventions

- Single `globals.css`. No Tailwind, no CSS-in-JS.
- Local component state + `localStorage`. No Redux / Zustand / Jotai.
- Email + password JWT. No OAuth providers unless asked.
- Django ORM only.
- Every fetch goes through `src/lib/api.ts::api()`.
- Lime (`#4ade80`) is reserved for uplift / live data — never UI chrome.
- `border-radius: 4px` on buttons. No pills.
- No emoji in code or UI.
- `ANTHROPIC_API_KEY` stays server-side. Never bundles, never payloads.

## License

MIT.
