<!-- thanks for the PR. keep it small and focused — one logical change per PR. -->

## what

<!-- 1-3 sentences. what does this change? -->

## why

<!-- what problem does it solve? link the issue if there is one (closes #N). -->

## how to test

<!-- exact commands or clicks. someone else should be able to reproduce. -->

```bash
# example:
docker compose up -d --build
npm run dev
# open http://localhost:3050/dashboard/audits, click "..."
```

## checklist

- [ ] web boots: `npm run dev` → http://localhost:3050
- [ ] api boots: `/api/health` returns `{"status":"ok"}`
- [ ] end-to-end path works (signup → audit → variant → expose → convert, where relevant)
- [ ] new Django models include the migration file
- [ ] no `console.log`, no `print()`, no commented-out code
- [ ] no new dependency, OR i justified it above
- [ ] follows the [style rules](../CONTRIBUTING.md#style-rules) (lime is reserved, mono nav, no pills, no emoji)
- [ ] `ANTHROPIC_API_KEY` stays server-side
