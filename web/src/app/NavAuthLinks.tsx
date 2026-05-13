"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readTokens } from "@/lib/api";

export default function NavAuthLinks() {
  // null = pre-hydration (don't flash a wrong CTA), false = signed out, true = signed in.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setAuthed(!!readTokens());
    sync();
    window.addEventListener("bandit-auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bandit-auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (authed === null) {
    // Reserve roughly the right width so the nav doesn't reflow on hydrate.
    return <span aria-hidden style={{ visibility: "hidden" }}>
      <Link href="/dashboard" className="btn btn-lime">go to dashboard →</Link>
    </span>;
  }

  if (authed) {
    return (
      <Link href="/dashboard" className="btn btn-lime">go to dashboard →</Link>
    );
  }

  return (
    <>
      <Link href="/signin" className="mono nav-signin">sign in</Link>
      <Link href="/signup" className="btn btn-lime">audit your site →</Link>
    </>
  );
}
