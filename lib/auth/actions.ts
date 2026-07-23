import type { User } from "@supabase/supabase-js";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import type { AuthCredentials, SignUpInput, SignUpResult } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

function appOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

/**
 * All Supabase Auth calls live here — UI and providers must not duplicate them.
 */
export async function signUp({
  email,
  password,
  name,
}: SignUpInput): Promise<SignUpResult> {
  const supabase = createClient();
  const origin = appOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim(),
        name: name.trim(),
      },
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/dashboard`
        : undefined,
    },
  });

  if (error) throw new Error(getAuthErrorMessage(error));

  return {
    user: data.user,
    session: data.session,
    needsEmailVerification: Boolean(data.user && !data.session),
  };
}

export async function signIn({ email, password }: AuthCredentials) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return data;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(getAuthErrorMessage(error));
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const origin = appOrigin();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin
      ? `${origin}/auth/callback?next=/login`
      : undefined,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return data;
}

export async function resendEmailVerification(email: string) {
  const supabase = createClient();
  const origin = appOrigin();

  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/dashboard`
        : undefined,
    },
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return data;
}

export async function getSessionUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}
