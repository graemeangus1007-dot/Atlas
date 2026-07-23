"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthField,
  AuthForm,
  AuthFormShell,
  PasswordField,
} from "@/components/auth/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { validateAuthCredentials } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Email/password login — show password, forgot password, loading spinner.
 */
export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail, error, clearError, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setLocalError(null);

    if (!isSupabaseConfigured() || !isConfigured) {
      setLocalError(
        "Supabase is not configured. Add your project URL and publishable key to .env.local.",
      );
      return;
    }

    const validation = validateAuthCredentials(email, password);
    if (!validation.ok) {
      setLocalError(validation.error);
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      const next = searchParams.get("next") || "/dashboard";
      router.replace(next);
      router.refresh();
    } catch {
      // error surfaced via Auth Context
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormShell
      title="Welcome back"
      subtitle="Log in to continue building with Atlas."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Create Account
          </Link>
        </>
      }
    >
      <AuthForm
        onSubmit={handleSubmit}
        loading={loading}
        error={localError || error}
        submitLabel="Login"
      >
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted transition-colors hover:text-accent"
          >
            Forgot Password?
          </Link>
        </div>
      </AuthForm>
    </AuthFormShell>
  );
}
