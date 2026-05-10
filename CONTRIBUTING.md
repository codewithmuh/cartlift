# Contributing to bandit

Thanks for being here. Bandit is built in public — issues, PRs, and "i tried
this and it broke" reports are all welcome.

## TL;DR

1. Fork the repo, clone your fork.
2. Follow the [Quickstart](./README.md#quickstart) — `docker compose up -d --build`
   then `npm run dev`.
3. Branch off `main`: `git checkout -b fix/short-description`.
4. Make the change. Keep it small and focused.
5. `git push` your branch and open a PR against `codewithmuh/bandit:main`.

## Before you open a PR

- [ ] The web app boots (`npm run dev` → http://localhost:3050).
- [ ] The api boots (`docker compose up -d` → http://localhost:8050/api/health
      returns `{"status":"ok"}`).
- [ ] You can sign up, run an audit, and the new code path works end-to-end.
- [ ] If you added a Django model, you ran `makemigrations` and committed
      the resulting migration file.
- [ ] If you touched the snippet (`/s/<token>.js`), you tested it from a real
      page (a tiny `index.html` with `<script async src="...">` is fine).
- [ ] No `console.log`, no commented-out code, no `print()` debugging left
      behind.
- [ ] No new dependency unless you've called it out in the PR description
      with the reason.

## What we'll merge fast

- Bug fixes with a clear repro.
- New audit types in `api/audits/runner.py` (e.g. accessibility, performance,
  brand-consistency). Follow the existing `_<type>_findings()` shape.
- Variant generator improvements — better prompts, better fallbacks.
- Snippet hardening — visitor ID stability, sample-rate tuning, CSP fixes.
- Dashboard polish that respects the [style rules](#style-rules).

## What we probably won't merge

- A CSS framework (Tailwind, Chakra, Mantine, …). Single `globals.css` is
  intentional — see [CLAUDE.md](./CLAUDE.md#conventions-claude-should-follow-when-editing-this-repo).
- A state library (Redux, Zustand, Jotai). Local state + `localStorage`
  is sufficient for the surface area we have.
- An ORM other than Django's.
- OAuth providers, unless we've discussed it in an issue first.
- Emoji in code or UI. The terminal aesthetic depends on its absence.
- Pull requests that bundle 5 unrelated changes into one diff.

If you want to do any of the above, **open an issue first** and we'll talk
about it before you write code.

## Style rules

These are non-negotiable for UI code:

- **Lime (`#4ade80`) is reserved.** Use it only for uplift / winning /
  live data. Never for nav, chrome, or default buttons.
- **Mono everywhere it counts.** `JetBrains Mono` for nav, buttons, tags,
  fine print, numbers. Sans (Inter) only for prose paragraphs and h1/h2.
- **Lowercase nav, lowercase fine print, lowercase tags.** Sentence-case
  in body prose. Capital "Bandit" only inside sentences.
- **Buttons:** `border-radius: 4px`. No pills.
- **Backgrounds:** flat `#0a0a0a` + 24px dot grid + 3.5%-opacity SVG film
  grain. No CSS gradients on body.
- **Eyebrows:** pulsing lime dot via `::before` + `@keyframes pulse`. Not
  emoji, not unicode bullets.

## Code conventions

- Every frontend fetch goes through `src/lib/api.ts::api()`. Don't
  hand-roll fetches in components.
- Keep the Anthropic call server-side only. `ANTHROPIC_API_KEY` must
  never appear in any frontend bundle, public env, or response payload.
- Python: 4-space indent, `snake_case`, type hints on new functions where
  it doesn't add noise.
- TypeScript: 2-space indent, `camelCase`, prefer named exports. No
  `any` unless you've documented why in a comment.
- Commits: short imperative subject (`fix: snippet visitor id collision`),
  one logical change per commit. Squash-merge is fine.

## Reporting bugs

Open a GitHub issue using the **bug** template. The fastest way to get a
fix is to include:

- The exact command / click that triggered it.
- The full error from `docker compose logs api --tail 100` (or browser
  console for frontend bugs).
- What you expected vs what happened.
- OS + Node + Docker versions if it might matter.

## Proposing features

Open an issue using the **feature** template **before** you build it.
A 5-minute back-and-forth on scope saves a 5-day rewrite.

## Security

Don't open a public issue for security bugs. Email
**codewithmuh@gmail.com** with details. Reasonable disclosure timeline:
30 days from acknowledgment.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
