"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, auth, readTokens, writeTokens } from "@/lib/api";

export default function SigninForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (readTokens()) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { access, refresh } = await auth.login(email, password);
      writeTokens({ access, refresh });
      router.push("/dashboard");
    } catch (e) {
      const detail =
        e instanceof ApiError && e.data && typeof e.data === "object"
          ? (e.data as { detail?: string }).detail ?? "Could not sign in."
          : "Could not sign in.";
      setErr(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <Link href="/" className="auth-brand">
        <span className="brand-mark">C</span>
        cartlift
      </Link>

      <h1>sign in to <em>cartlift.</em></h1>
      <p className="subhead">welcome back. your experiments are still running.</p>

      {err && <div className="form-error">{err}</div>}

      <div className="field">
        <label>email</label>
        <input type="email" required autoComplete="email"
          placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field">
        <label>password</label>
        <input type="password" required autoComplete="current-password"
          placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      <button type="submit" className="btn btn-lime" disabled={busy} style={{ width: "100%", justifyContent: "center", padding: "14px" }}>
        {busy ? "signing in…" : "sign in →"}
      </button>

      <p className="form-link">
        no account? <Link href="/signup">get a demo</Link>
      </p>
    </form>
  );
}
