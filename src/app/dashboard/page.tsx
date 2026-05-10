import Link from "next/link";

export default function DashboardHome() {
  return (
    <>
      <div className="dash-header">
        <div>
          <h1>welcome to <em>the daemon.</em></h1>
          <p className="sub">~ run your first audit, register a site, then watch the bandit work</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Link href="/dashboard/audits" className="empty-card" style={{ textDecoration: "none" }}>
          <h3>run an audit</h3>
          <p>~ paste a url. get annotated findings in &lt;30s</p>
        </Link>
        <Link href="/dashboard/sites" className="empty-card" style={{ textDecoration: "none" }}>
          <h3>register a site</h3>
          <p>~ install the snippet. start collecting samples</p>
        </Link>
        <Link href="/dashboard/experiments" className="empty-card" style={{ textDecoration: "none" }}>
          <h3>review experiments</h3>
          <p>~ approve, kill, or let the bandit decide</p>
        </Link>
      </div>
    </>
  );
}
