"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthField,
  AuthForm,
  AuthFormShell,
  PasswordField,
} from "@/components/auth/auth-form";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { validateSignUpForm } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Signup — name, email, password, confirm password + email verification.
 */
export default function SignupForm() {
  const router = useRouter();
  const {
    signUpWithEmail,
    resendVerification,
    error,
    clearError,
    isConfigured,
  } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setLocalError(null);
    setSuccess(null);
    setNeedsVerification(false);

    if (!isSupabaseConfigured() || !isConfigured) {
      setLocalError(
        "Supabase is not configured. Add your project URL and publishable key to .env.local.",
      );
      return;
    }

    const validation = validateSignUpForm({
      name,
      email,
      password,
      confirmPassword,
    });
    if (!validation.ok) {
      setLocalError(validation.error);
      return;
    }

    setLoading(true);
    try {
      const result = await signUpWithEmail(
        name.trim(),
        email.trim(),
        password,
      );

      if (result.needsEmailVerification) {
        setNeedsVerification(true);
        setSuccess("Check your email to verify your account.");
        return;
      }

      // Confirmation disabled — session already created; user is signed in.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      // error surfaced via Auth Context
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    clearError();
    setLocalError(null);
    setResending(true);
    try {
      await resendVerification(email.trim());
      setSuccess("Check your email to verify your account.");
    } catch {
      // error surfaced via Auth Context
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthFormShell
      title="Create your account"
      subtitle="Join Atlas and start building your website in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Login
          </Link>
        </>
      }
    >
      <AuthForm
        onSubmit={handleSubmit}
        loading={loading}
        error={localError || error}
        success={success}
        submitLabel="Create Account"
      >
        <AuthField
          id="name"
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
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
          autoComplete="new-password"
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
      </AuthForm>

      {needsVerification ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          disabled={resending || !email.trim()}
          onClick={() => void handleResend()}
        >
          {resending ? "Sending…" : "Resend verification email"}
        </Button>
      ) : null}
    </AuthFormShell>
  );
}
