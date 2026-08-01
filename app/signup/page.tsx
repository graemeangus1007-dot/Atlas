import type { Metadata } from "next";
import { Suspense } from "react";
import SignupForm from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account — Atlas",
  description: "Create an Atlas account.",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
