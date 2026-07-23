const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export type AuthValidationResult = {
  ok: boolean;
  error: string | null;
};

/** Client-side email / password validation before calling Supabase. */
export function validateEmail(email: string): AuthValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: "Email is required." };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  return { ok: true, error: null };
}

export function validateName(name: string): AuthValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required." };
  }
  if (trimmed.length < 2) {
    return { ok: false, error: "Please enter your full name." };
  }
  return { ok: true, error: null };
}

export function validatePassword(
  password: string,
  { minLength = MIN_PASSWORD_LENGTH }: { minLength?: number } = {},
): AuthValidationResult {
  if (!password) {
    return { ok: false, error: "Password is required." };
  }
  if (password.length < minLength) {
    return {
      ok: false,
      error: `Password must be at least ${minLength} characters.`,
    };
  }
  return { ok: true, error: null };
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
): AuthValidationResult {
  if (!confirmPassword) {
    return { ok: false, error: "Please confirm your password." };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords must match." };
  }
  return { ok: true, error: null };
}

export function validateAuthCredentials(
  email: string,
  password: string,
): AuthValidationResult {
  const emailResult = validateEmail(email);
  if (!emailResult.ok) return emailResult;
  return validatePassword(password);
}

/** Full signup form validation (name, email, password, confirm). */
export function validateSignUpForm(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): AuthValidationResult {
  const nameResult = validateName(input.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = validateEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const passwordResult = validatePassword(input.password);
  if (!passwordResult.ok) return passwordResult;

  return validatePasswordConfirmation(input.password, input.confirmPassword);
}
