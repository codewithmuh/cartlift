import { Suspense } from "react";
import SignupForm from "./SignupForm";
import SignupCanvas from "./SignupCanvas";

export const metadata = { title: "get a demo — bandit" };

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
