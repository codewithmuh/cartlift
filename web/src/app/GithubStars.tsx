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

export default async function GithubStars({ repo = "codewithmuh/bandit" }: { repo?: string }) {
  const stars = await getStars(repo);
  return (
    <a href={`https://github.com/${repo}`} className="badge" aria-label={`Bandit on GitHub${stars ? ` — ${stars} stars` : ""}`}>
      <span className="key">★</span>
      {stars !== null ? fmt(stars) : "github"} on github ↗
    </a>
  );
}
