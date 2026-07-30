/**
 * Sanitize OpenAI / provider failures into stable categories (Sprint 28.0B).
 * Never include API keys, prompts, or raw response bodies.
 */

import { AiError, isAiError } from "@/lib/ai/errors";

export const OPENAI_FAILURE_CATEGORIES = [
  "provider_unavailable",
  "authentication",
  "quota",
  "rate_limit",
  "timeout",
  "model",
  "schema",
  "refusal",
  "incomplete",
  "validation",
  "unknown",
] as const;

export type OpenAiFailureCategory = (typeof OPENAI_FAILURE_CATEGORIES)[number];

export type CritiqueFallbackReason = OpenAiFailureCategory;

export type CategorizedAiFailure = {
  category: OpenAiFailureCategory;
  /** Safe user/admin message — no secrets. */
  message: string;
  status: number | null;
  openaiRequestId: string | null;
  /** Atlas AiError code when applicable. */
  code: string | null;
  retryable: boolean;
};

function readStatus(error: unknown): number | null {
  if (isAiError(error)) return error.status;
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return null;
}

/** Extract OpenAI x-request-id from SDK response or error when present. */
export function extractOpenAiRequestId(errorOrResponse: unknown): string | null {
  if (!errorOrResponse || typeof errorOrResponse !== "object") return null;
  const obj = errorOrResponse as Record<string, unknown>;

  if (typeof obj.id === "string" && obj.id.startsWith("resp_")) {
    return obj.id;
  }
  if (typeof obj.request_id === "string") return obj.request_id;
  if (typeof obj.requestId === "string") return obj.requestId;

  const headers = obj.headers;
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, unknown>;
    const fromHeader =
      h["x-request-id"] ?? h["X-Request-Id"] ?? h["request-id"];
    if (typeof fromHeader === "string") return fromHeader;
    if (
      fromHeader &&
      typeof fromHeader === "object" &&
      "toString" in fromHeader
    ) {
      return String(fromHeader);
    }
  }

  const error = obj.error;
  if (error && typeof error === "object") {
    const nested = extractOpenAiRequestId(error);
    if (nested) return nested;
  }

  const cause = obj.cause;
  if (cause) {
    const nested = extractOpenAiRequestId(cause);
    if (nested) return nested;
  }

  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "OpenAI request failed.";
}

/**
 * Map a thrown error / AiError into a stable failure category.
 */
export function categorizeOpenAiFailure(error: unknown): CategorizedAiFailure {
  const status = readStatus(error);
  const message = messageOf(error);
  const lower = message.toLowerCase();
  const openaiRequestId = extractOpenAiRequestId(error);
  const code = isAiError(error) ? error.code : null;

  if (code === "not_configured") {
    return {
      category: "provider_unavailable",
      message: "OpenAI is not configured for this environment.",
      status,
      openaiRequestId,
      code,
      retryable: false,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    code === "unauthorized" ||
    code === "forbidden" ||
    /invalid[- ]api[- ]key|incorrect api key|authentication|unauthorized/i.test(
      lower,
    )
  ) {
    return {
      category: "authentication",
      message: "OpenAI rejected the API credentials.",
      status: status ?? 401,
      openaiRequestId,
      code: code ?? "unauthorized",
      retryable: false,
    };
  }

  if (
    /insufficient_quota|exceeded your current quota|billing|payment required|credit/i.test(
      lower,
    ) ||
    status === 402
  ) {
    return {
      category: "quota",
      message: "OpenAI quota is exhausted for this account.",
      status: status ?? 402,
      openaiRequestId,
      code: code ?? "provider_error",
      retryable: false,
    };
  }

  if (
    status === 429 ||
    code === "rate_limited" ||
    (/rate limit|too many requests/i.test(lower) &&
      !/insufficient_quota|quota/i.test(lower))
  ) {
    return {
      category: "rate_limit",
      message: "OpenAI rate limit reached.",
      status: 429,
      openaiRequestId,
      code: code ?? "rate_limited",
      retryable: true,
    };
  }

  if (
    /timeout|timed out|aborted|abort/i.test(lower) ||
    (error instanceof Error && error.name === "AbortError") ||
    status === 504 ||
    status === 408
  ) {
    return {
      category: "timeout",
      message: "OpenAI request timed out.",
      status: status ?? 504,
      openaiRequestId,
      code: code ?? "provider_error",
      retryable: true,
    };
  }

  if (
    /model_not_found|does not exist|invalid model|unsupported model|unknown model/i.test(
      lower,
    )
  ) {
    return {
      category: "model",
      message: "The configured OpenAI model is not available for this account.",
      status: status ?? 400,
      openaiRequestId,
      code: code ?? "bad_request",
      retryable: false,
    };
  }

  if (
    /invalid_json_schema|unsupported.*schema|json schema|schema.*invalid|additionalproperties|strict.*schema/i.test(
      lower,
    )
  ) {
    return {
      category: "schema",
      message: "OpenAI rejected the structured-output schema.",
      status: status ?? 400,
      openaiRequestId,
      code: code ?? "bad_request",
      retryable: false,
    };
  }

  if (/refusal|refused to|content.?policy|safety/i.test(lower)) {
    return {
      category: "refusal",
      message: "OpenAI refused to generate a critique for this request.",
      status: status ?? 400,
      openaiRequestId,
      code: code ?? "invalid_response",
      retryable: false,
    };
  }

  if (/incomplete|max_output|length limit|truncated/i.test(lower)) {
    return {
      category: "incomplete",
      message: "OpenAI returned an incomplete critique response.",
      status: status ?? 502,
      openaiRequestId,
      code: code ?? "invalid_response",
      retryable: false,
    };
  }

  if (
    code === "invalid_response" ||
    /validation|malformed json|empty response|no json|schema validation/i.test(
      lower,
    )
  ) {
    return {
      category: "validation",
      message: "OpenAI response failed Atlas validation.",
      status: status ?? 502,
      openaiRequestId,
      code: code ?? "invalid_response",
      retryable: false,
    };
  }

  return {
    category: "unknown",
    message: "OpenAI could not complete the design critique.",
    status: status ?? 502,
    openaiRequestId,
    code: code ?? "provider_error",
    retryable: status !== null && status >= 500,
  };
}

/** Whether Atlas should retry this categorized failure. */
export function isRetryableOpenAiCategory(
  category: OpenAiFailureCategory,
): boolean {
  return category === "rate_limit" || category === "timeout" || category === "unknown";
}

/**
 * Concise user-facing fallback copy. Owner/admin variants avoid exposing key management to customers.
 */
export function formatFallbackUserMessage(input: {
  category: OpenAiFailureCategory;
  requestId?: string | null;
  audience?: "customer" | "owner";
}): string {
  const id = input.requestId ? ` (request ${input.requestId})` : "";
  const audience = input.audience ?? "customer";

  if (audience === "owner" && (input.category === "authentication" || input.category === "model" || input.category === "quota" || input.category === "provider_unavailable")) {
    return `Atlas could not access the configured OpenAI model${id}. Check the AI runtime settings. Showing a labeled local review instead.`;
  }

  switch (input.category) {
    case "timeout":
    case "rate_limit":
    case "unknown":
    case "provider_unavailable":
      return `OpenAI is temporarily unavailable${id}, so I used Atlas’s local review.`;
    case "authentication":
    case "quota":
    case "model":
      return `I couldn’t reach the AI design critic just now${id}. Showing a labeled local review instead.`;
    case "schema":
    case "validation":
    case "incomplete":
    case "refusal":
      return `The AI critique couldn’t be completed safely${id}. Showing a labeled local review instead.`;
    default:
      return `I couldn’t complete a full AI critique just now${id}. Showing a labeled local review instead.`;
  }
}

/** Attach category metadata onto an AiError for upstream logging. */
export function aiErrorFromCategory(
  categorized: CategorizedAiFailure,
): AiError {
  const code =
    categorized.code === "unauthorized" ||
    categorized.code === "forbidden" ||
    categorized.code === "bad_request" ||
    categorized.code === "rate_limited" ||
    categorized.code === "not_configured" ||
    categorized.code === "not_implemented" ||
    categorized.code === "provider_error" ||
    categorized.code === "invalid_response"
      ? categorized.code
      : categorized.category === "authentication"
        ? "unauthorized"
        : categorized.category === "rate_limit"
          ? "rate_limited"
          : categorized.category === "validation" ||
              categorized.category === "refusal" ||
              categorized.category === "incomplete"
            ? "invalid_response"
            : categorized.category === "provider_unavailable"
              ? "not_configured"
              : "provider_error";

  return new AiError(code, categorized.message, {
    status: categorized.status ?? undefined,
  });
}
