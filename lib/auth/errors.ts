/**
 * Normalize Supabase Auth errors into short user-facing messages.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);

  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email before signing in. Check your inbox for a confirmation link.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (lower.includes("unable to validate email") || lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("email rate limit") || lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (
    lower.includes("placeholder") ||
    lower.includes("missing next_public_supabase")
  ) {
    return message;
  }

  return message || "Something went wrong. Please try again.";
}
