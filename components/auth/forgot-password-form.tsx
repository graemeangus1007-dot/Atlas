"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AuthField,
  AuthForm,
  AuthFormShell,
} from "@/components/auth/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { validateEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Forgot password — sends a Supabase reset email.
 */
export default function ForgotPasswordForm() {
  const { forgotPassword, error, clearError, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setLocalError(null);
    setSuccess(null);

    if (!isSupabaseConfigured() || !isConfigured) {
      setLocalError(
        "Supabase is not configured. Add your project URL and publishable key to .env.local.",
      );
      return;
    }

    const validation = validateEmail(email);
    if (!validation.ok) {
      setLocalError(validation.error);
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSuccess("Check your email for a password reset link.");
    } catch {
      // error surfaced via Auth Context
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormShell
      title="Reset your password"
      subtitle="Enter your email and we’ll send a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Log In
          </Link>
        </>
      }
    >
      <AuthForm
        onSubmit={handleSubmit}
        loading={loading}
        error={localError || error}
        success={success}
        submitLabel="Send reset link"
      >
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
      </AuthForm>
    </AuthFormShell>
  );
}
