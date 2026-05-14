import type { Metadata } from "next";
import { Suspense } from "react";
import SignupForm from "./SignupForm";
import SignupCanvas from "./SignupCanvas";

export const metadata: Metadata = {
  title: "Get started with Cartlift — free audit",
  description:
    "Create your Cartlift account in 30 seconds. No card. First three audits + first experiment on us. Conversion · SEO · trust · Google Merchant.",
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
