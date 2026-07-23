import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login — Atlas",
  description: "Log in to your Atlas account.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
