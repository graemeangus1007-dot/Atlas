"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getSessionUser,
  requestPasswordReset,
  resendEmailVerification,
  signIn,
  signOut,
  signUp,
} from "@/lib/auth/actions";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import type { SignUpResult } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/types";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  clearError: () => void;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type SessionProviderProps = {
  children: ReactNode;
};

/**
 * Session / Auth Context — single source of truth for the signed-in user.
 *
 * Persistence: Supabase stores the session in cookies (via createBrowserClient).
 * On mount we call getSession(); onAuthStateChange keeps React state in sync
 * across refreshes and tabs.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const clearError = useCallback(() => setError(null), []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      try {
        return await signUp({ name, email, password });
      } catch (err) {
        setError(getAuthErrorMessage(err));
        throw err;
      }
    },
    [],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await signIn({ email, password });
      } catch (err) {
        setError(getAuthErrorMessage(err));
        throw err;
      }
    },
    [],
  );

  const signOutUser = useCallback(async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await requestPasswordReset(email);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    try {
      await resendEmailVerification(email);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      throw err;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const next = await getSessionUser();
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: configured,
      error,
      clearError,
      signUpWithEmail,
      signInWithEmail,
      signOutUser,
      forgotPassword,
      resendVerification,
      refreshUser,
    }),
    [
      user,
      session,
      isLoading,
      configured,
      error,
      clearError,
      signUpWithEmail,
      signInWithEmail,
      signOutUser,
      forgotPassword,
      resendVerification,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @deprecated Prefer SessionProvider — kept as an alias for existing imports. */
export const AuthProvider = SessionProvider;

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within a SessionProvider");
  }
  return context;
}

export function useSession() {
  const { user, session, isLoading, isConfigured } = useAuth();
  return { user, session, isLoading, isConfigured };
}
