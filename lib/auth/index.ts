export type { AuthCredentials, SignUpInput, SignUpResult } from "@/lib/auth/types";
export { getAuthErrorMessage } from "@/lib/auth/errors";
export {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validateAuthCredentials,
  validateSignUpForm,
} from "@/lib/auth/validation";
export {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  resendEmailVerification,
  getSessionUser,
} from "@/lib/auth/actions";
export {
  updateAuthSession,
  PROTECTED_PREFIXES,
  AUTH_ROUTES,
} from "@/lib/auth/middleware";
export {
  AuthProvider,
  SessionProvider,
  useAuth,
  useSession,
  type AuthContextValue,
} from "@/lib/auth/auth-provider";
