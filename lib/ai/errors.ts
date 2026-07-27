import type { AiErrorCode } from "@/lib/ai/types";

/**
 * Typed AI errors — never include API keys or raw model payloads in messages.
 */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;

  constructor(
    code: AiErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AiError";
    this.code = code;
    this.status = options?.status ?? statusForCode(code);
  }
}

export function statusForCode(code: AiErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "bad_request":
      return 400;
    case "rate_limited":
      return 429;
    case "not_configured":
      return 503;
    case "not_implemented":
      return 501;
    case "provider_error":
    case "invalid_response":
      return 502;
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

/** Safe user-facing message (no secrets). */
export function safeAiErrorMessage(
  error: unknown,
  fallback = "AI generation failed. Please try again.",
): string {
  if (error instanceof AiError) return error.message;
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (/api[_-]?key|secret|token|authorization|bearer/i.test(msg)) {
      return fallback;
    }
    if (msg.length > 240) return fallback;
    return msg;
  }
  return fallback;
}
