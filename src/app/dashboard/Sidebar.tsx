"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, auth, clearTokens, readTokens, type Me } from "@/lib/api";

const ITEMS = [
  { href: "/dashboard", label: "overview",
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg> },
  { href: "/dashboard/audits", label: "audits",
    icon: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg> },
  { href: "/dashboard/experiments", label: "experiments",
    icon: <svg viewBox="0 0 24 24"><path d="M9 3v6L4 21h16L15 9V3" /><path d="M9 3h6" /></svg> },
  { href: "/dashboard/sites", label: "sites",
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 010 18" /><path d="M12 3a14 14 0 000 18" /></svg> },
  { href: "/dashboard/settings", label: "settings",
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.13-1.4l2.1-1.6-2-3.4-2.5.9a7 7 0 00-2.4-1.4L13.7 2h-3.4l-.4 2.5a7 7 0 00-2.4 1.4l-2.5-.9-2 3.4 2.1 1.6A7 7 0 005 12c0 .48.05.95.13 1.4l-2.1 1.6 2 3.4 2.5-.9c.7.5 1.5 1 2.4 1.4l.4 2.5h3.4l.4-2.5c.9-.4 1.7-.9 2.4-1.4l2.5.9 2-3.4-2.1-1.6c.08-.45.13-.92.13-1.4z" /></svg> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const t = readTokens();
    if (!t) {
      router.replace("/signin");
      return;
    }
    auth.me().then(setMe).catch((e) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        clearTokens();
        router.replace("/signin");
      }
    });
  }, [router]);

  function signOut() {
    clearTokens();
    router.replace("/signin");
  }

  return (
    <aside className="dash-side">
      <Link href="/" className="brand">
        <span className="brand-mark">B</span>
        bandit
      </Link>

      <div className="group">workspace</div>
      {ITEMS.map((it) => {
        const active = pathname === it.href ||
          (it.href !== "/dashboard" && pathname.startsWith(it.href));
        return (
          <Link key={it.href} href={it.href} className={`dash-link ${active ? "active" : ""}`}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        );
      })}

      <div className="footer">
        <span>signed in</span>
        <span className="you">{me?.company || me?.email || "…"}</span>
        <button onClick={signOut} className="dash-link" style={{ marginTop: 10, padding: "6px 8px" }}>
          sign out →
        </button>
      </div>
    </aside>
  );
}
