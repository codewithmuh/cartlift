# bandit

> **Convert more visitors. Open-source.**
>
> The CRO daemon. Audits any URL for **conversion · seo · compliance · google merchant**, drafts page variants, ships them behind a JS snippet, and lets a multi-armed bandit allocate traffic to whatever wins.

```
┌─ bandit ─────────────────────────────────────────────────────────────┐
│  audit  →  draft  →  approve  →  ship  →  allocate  →  auto-ship    │
└──────────────────────────────────────────────────────────────────────┘
```

Built in public by [@codewithmuh](https://www.youtube.com/@codewithmuh) as a buildable open-source alternative to closed CRO platforms (Sherpa, VWO, Optimizely). MIT licensed — clone it, fork it, sell it.

---

## What it does

| Audit | What it finds | Output |
|---|---|---|
| **CRO** | Hero copy, CTA contrast, social proof, mobile-fold cutoff, friction in checkout / pricing | 3-5 short findings · predicted lift % per finding · drafted page variants |
| **SEO** | Title / meta / schema / H1 hierarchy / render-blocking resources | 4-6 short findings · severity per finding |
| **Compliance** | Privacy + terms + returns alignment, contact identity, payment-method visibility, checkout transparency | Long-form report · 14-item checklist · 6 sections + recommendations + conclusion |
| **GMC** | Google Merchant Center suspension audit — misrepresentation, prohibited content, shipping/returns alignment | GMC-grade report · diagnostics table + account areas + website checks + sections + conclusion |

After the audit, the daemon can:

1. **Draft variants** — turn each CRO/SEO finding into 2-3 candidate page variants (Claude or canned fallback)
2. **A/B them** — your customer site loads `<script async src="…/s/<token>.js">`, the snippet picks variants per visitor, fires `expose` + `convert` events
3. **Allocate** — run `python manage.py allocate_bandits` (or cron it) and Thompson sampling re-weights traffic toward winners
4. **Auto-ship** — when the leader has ≥500 samples + ≥95% posterior confidence, the experiment is pinned 100% to the winner and marked `winner`

The whole loop is in this repo. Nothing is hand-waved.

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
git clone https://github.com/codewithmuh/bandit.git
cd bandit

# 1. backend + database
cp .env.example .env                 # optional: paste ANTHROPIC_API_KEY
docker compose up -d --build         # api :8050 · postgres :5450

# 2. frontend
npm install
npm run dev                          # http://localhost:3050
```

Sign up at [`/signup`](http://localhost:3050/signup), paste a URL into the audit bar, watch the report come back.

> **No Claude key?** Every audit type returns a deterministic canned report so the demo flow always works. Useful on planes and during interviews.

---

## Ports

| service | url |
|---|---|
| **web** (Next.js) | http://localhost:3050 |
| **api** (Django + Gunicorn) | http://localhost:8050 |
| **django admin** | http://localhost:8050/admin · `admin@bandit.dev` / `bandit_admin_dev` |
| **postgres** | `localhost:5450` (user `bandit`, db `bandit`, pw `bandit_dev`) |

---

## Repo layout

```
bandit/
├── src/                   # Next.js — marketing + dashboard
│   ├── app/
│   │   ├── page.tsx           # landing page (hero · audits grid · how · dashboard mock · POV · OS manifesto · FAQ)
│   │   ├── signin/  signup/   # JWT auth (signup is audit-aware via ?audit=URL)
│   │   └── dashboard/         # AuditBar header + 4 routes:
│   │       ├── audits/        #   /audits + tabs + auto-run
│   │       ├── audits/[id]/   #   per-audit report (downloadable .md / .json / pdf)
│   │       ├── sites/         #   register sites + copy install snippet
│   │       ├── experiments/   #   list + drill-down + approve/kill/pause
│   │       └── settings/      #   account
│   └── lib/api.ts             # typed fetch wrapper · JWT in localStorage
│
├── api/                   # Django + DRF
│   ├── conf/                  # settings · urls · wsgi
│   ├── accounts/              # custom email-login user · JWT issuance
│   ├── sites/                 # customer sites + bnd_xxx snippet tokens
│   ├── experiments/           # Experiment · Variant · Sample
│   │   └── management/commands/allocate_bandits.py
│   ├── audits/                # Audit model + runner.py + generator.py
│   └── snippet/               # public, no-auth: /s/<token>.js + /active + /expose + /convert
│
├── docker-compose.yml     # postgres + api
├── CLAUDE.md              # full architecture notes for Claude Code sessions
└── README.md
```

---

## API surface

### Authenticated (JWT bearer)

```
GET   /api/health                                public
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
GET   /s/<token>.js                              ~3 KB JS for customer sites
GET   /s/<token>/active                          JSON of active experiments + variants
POST  /s/<token>/expose                          {"variant_id", "visitor"}
POST  /s/<token>/convert                         {"variant_id", "visitor"}
```

---

## The audit pipeline

`api/audits/runner.py` — the "we own it" piece. Sequence:

1. **Fetch** the URL with our UA, strip scripts/styles, collapse to ~8K chars of visible text, extract `<title>`.
2. **Prompt** Claude with a type-specific consultant prompt (CRO / SEO / Compliance / GMC). Pull the first JSON block out of the response.
3. **Fallback** — if `ANTHROPIC_API_KEY` is unset OR the call fails, return a hand-written canned report. The demo never breaks.
4. **Persist** `{status, page_title, summary, findings[], report{}, elapsed_ms}` on the `Audit` row.

Sync request handler. For prod scale, push the runner to Celery / Trigger.dev — the surface is a single function call.

---

## The variant generator

`api/audits/generator.py` — turns a CRO/SEO audit's findings into draft Experiments + Variants on a chosen Site.

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

## The snippet (~3 KB, what customers paste in their `<head>`)

```html
<script async src="https://your-bandit-instance.example.com/s/bnd_xxx.js"></script>
```

```js
// fire conversions from anywhere on the customer page:
window.bandit && window.bandit.convert(experimentId);
```

What it does:

- Picks a stable variant per visitor (sticky via `localStorage`)
- Swaps DOM via the experiment's CSS selector (`h1` for `hero_headline`, etc.)
- Fires `expose` on load via `navigator.sendBeacon`
- Exposes `window.bandit.convert(experimentId)` — call it on a button click / form submit
- Circuit breaker — if anything throws, the original page renders untouched. We don't break the host.

---

## Auth flow

1. `/signup` → `POST /api/auth/signup` → returns `{access, refresh, user}`
2. `writeTokens()` puts both in `localStorage` and dispatches a `bandit-auth` event
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
docker compose exec db psql -U bandit

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
- Lime (`#15803d` text · `#4ade80` glows) is reserved for uplift / live / winning data — never UI chrome.
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
