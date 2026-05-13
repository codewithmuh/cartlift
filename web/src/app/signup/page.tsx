import type { Metadata } from "next";
import { Suspense } from "react";
import SignupForm from "./SignupForm";
import SignupCanvas from "./SignupCanvas";

export const metadata: Metadata = {
  title: "Get started with Bandit — free audit",
  description:
    "Create your Bandit account in 30 seconds. No card. First three audits + first experiment on us. CRO · SEO · compliance · Google Merchant.",
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
};

export default function SignupPage() {
  return (
    <div className="auth-shell">
      <Suspense>
        <SignupCanvas />
      </Suspense>
      <SignupForm />
    </div>
  );
}
