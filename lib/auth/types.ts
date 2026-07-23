import type { Session, User } from "@supabase/supabase-js";

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpInput = AuthCredentials & {
  name: string;
};

export type SignUpResult = {
  user: User | null;
  session: Session | null;
  /** True when Supabase requires email confirmation before a session is issued. */
  needsEmailVerification: boolean;
};
