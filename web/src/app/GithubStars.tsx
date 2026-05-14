// Server component — fetches live star count from GitHub's public API.
// Revalidates hourly; degrades gracefully to a static badge on rate-limit / outage.

async function getStars(repo: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { stargazers_count?: number };
    return typeof j.stargazers_count === "number" ? j.stargazers_count : null;
  } catch {
    return null;
  }
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

// Hide the star count until it crosses a credibility threshold. A "★ 1 on
// github" badge on an open-source pitch actively hurts trust — below this
// floor we surface the factual MIT differentiator instead, which doesn't
// depend on traction.
const STAR_DISPLAY_THRESHOLD = 25;

export default async function GithubStars({ repo = "codewithmuh/cartlift" }: { repo?: string }) {
  const stars = await getStars(repo);
  const showCount = stars !== null && stars >= STAR_DISPLAY_THRESHOLD;
  return (
    <a
      href={`https://github.com/${repo}`}
      className="badge"
      aria-label={showCount ? `Cartlift on GitHub — ${stars} stars` : "Cartlift on GitHub — MIT licensed, self-hostable"}
    >
      <span className="key">★</span>
      {showCount ? `${fmt(stars!)} on github ↗` : "MIT · self-hostable ↗"}
    </a>
  );
}
