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
  "output_limit",
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
  /** OpenAI error.code when present (e.g. invalid_json_schema). */
  openaiErrorCode?: string | null;
  /** OpenAI error.param when present (schema path hint). */
  openaiErrorParam?: string | null;
  /** Sanitized schema path extracted from the error message. */
  schemaPath?: string | null;
  /** Responses API incomplete_details.reason when present. */
  incompleteReason?: string | null;
};

/**
 * Map Responses API incomplete_details.reason to an Atlas failure category.
 */
export function categorizeIncompleteReason(
  reason: string | null | undefined,
): OpenAiFailureCategory {
  const lower = (reason ?? "").toLowerCase();
  if (!lower) return "incomplete";
  if (/max_output_tokens|max_tokens|output_token/i.test(lower)) {
    return "output_limit";
  }
  if (
    /content_filter|content_policy|safety|refusal|blocked/i.test(lower)
  ) {
    return "refusal";
  }
  return "incomplete";
}

/**
 * Extract sanitized schema-rejection diagnostics from an OpenAI SDK error.
 * Never returns prompts, project content, or raw response bodies.
 */
export function sanitizeOpenAiSchemaError(error: unknown): {
  httpStatus: number | null;
  openaiErrorCode: string | null;
  openaiErrorParam: string | null;
  schemaPath: string | null;
  openaiRequestId: string | null;
  message: string;
} {
  const httpStatus = readStatus(error);
  const openaiRequestId = extractOpenAiRequestId(error);
  let openaiErrorCode: string | null = null;
  let openaiErrorParam: string | null = null;
  let message = messageOf(error);

  const atlasCodes = new Set([
    "bad_request",
    "provider_error",
    "invalid_response",
    "unauthorized",
    "forbidden",
    "rate_limited",
    "not_configured",
    "not_implemented",
  ]);
  const walk = (value: unknown, depth = 0): void => {
    if (!value || typeof value !== "object" || depth > 4) return;
    const obj = value as Record<string, unknown>;
    // Prefer nested OpenAI payload before Atlas AiError wrappers.
    if (obj.error) walk(obj.error, depth + 1);
    if (obj.cause) walk(obj.cause, depth + 1);
    if (typeof obj.code === "string" && !openaiErrorCode) {
      const code = obj.code.slice(0, 80);
      if (!atlasCodes.has(code)) {
        openaiErrorCode = code;
      }
    }
    if (typeof obj.param === "string" && !openaiErrorParam) {
      openaiErrorParam = obj.param.slice(0, 200);
    }
    if (
      typeof obj.type === "string" &&
      obj.type.includes("invalid") &&
      !openaiErrorCode
    ) {
      openaiErrorCode = obj.type.slice(0, 80);
    }
  };
  walk(error);

  // Prefer nested OpenAI error.message when present (cleaner than SDK wrapper).
  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as { error?: { message?: unknown } }).error?.message ===
      "string"
  ) {
    message = String(
      (error as { error: { message: string } }).error.message,
    ).slice(0, 400);
  } else {
    message = message.slice(0, 400);
  }

  // Extract context=('properties', 'foo', ...) style paths — no field values.
  const contextMatch = message.match(
    /context=\(([^)]{1,240})\)/i,
  );
  const requiredMatch = message.match(
    /(?:Missing|required|'required').{0,80}?'([A-Za-z0-9_.]+)'/i,
  );
  const propertyMatch = message.match(
    /(?:property|properties)[^A-Za-z0-9_]*['"]?([A-Za-z0-9_]+)['"]?/i,
  );
  // Prefer concrete schema context path over the generic text.format.schema param.
  const schemaPath =
    (contextMatch ? `context=(${contextMatch[1]})` : null) ??
    openaiErrorParam ??
    (requiredMatch ? requiredMatch[1] : null) ??
    (propertyMatch ? propertyMatch[1] : null);

  // Strip any accidental long JSON blobs from the message.
  const safeMessage = message
    .replace(/\{[\s\S]{80,}\}/g, "{…}")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 280);

  return {
    httpStatus,
    openaiErrorCode,
    openaiErrorParam,
    schemaPath: schemaPath ? String(schemaPath).slice(0, 200) : null,
    openaiRequestId,
    message: safeMessage || "The configured schema was rejected by the Responses API.",
  };
}

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
  // Responses API objects always carry object:"response" + id.
  if (
    typeof obj.id === "string" &&
    obj.id.length > 0 &&
    (obj.object === "response" || typeof obj.output !== "undefined")
  ) {
    return obj.id;
  }
  if (typeof obj.request_id === "string") return obj.request_id;
  if (typeof obj.requestId === "string") return obj.requestId;
  if (typeof obj.openaiRequestId === "string") return obj.openaiRequestId;

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
  const schemaDiag = sanitizeOpenAiSchemaError(error);

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

  // gpt-5.2 rejects temperature/top_p unless reasoning.effort is "none"
  if (
    /unsupported parameter|not supported with this model|unknown parameter|invalid_request_error/i.test(
      lower,
    ) &&
    /temperature|top_p|reasoning|logprobs/i.test(lower)
  ) {
    return {
      category: "model",
      message:
        "OpenAI rejected request parameters for this model (e.g. temperature with reasoning).",
      status: status ?? 400,
      openaiRequestId,
      code: code ?? "bad_request",
      retryable: false,
    };
  }

  if (
    /invalid_json_schema|invalid schema|unsupported.*schema|json[_ ]schema|schema.*invalid|schema.*(reject|fail)|additionalproperties|strict.*schema|text\.format|response_format|required.*properties|properties.*required|'required'/i.test(
      lower,
    )
  ) {
    return {
      category: "schema",
      message: schemaDiag.message.startsWith("Invalid")
        ? schemaDiag.message
        : "The configured schema was rejected by the Responses API.",
      status: status ?? schemaDiag.httpStatus ?? 400,
      openaiRequestId: schemaDiag.openaiRequestId ?? openaiRequestId,
      code: code ?? "bad_request",
      retryable: false,
      openaiErrorCode: schemaDiag.openaiErrorCode,
      openaiErrorParam: schemaDiag.openaiErrorParam,
      schemaPath: schemaDiag.schemaPath,
    };
  }

  if (/unsupported parameter|not supported with this model/i.test(lower)) {
    return {
      category: "model",
      message: "OpenAI rejected a request parameter for the configured model.",
      status: status ?? 400,
      openaiRequestId,
      code: code ?? "bad_request",
      retryable: false,
    };
  }

  // Prefer explicit category stamped on AiError by the pipeline.
  if (
    typeof error === "object" &&
    error !== null &&
    "category" in error &&
    typeof (error as { category: unknown }).category === "string"
  ) {
    const stamped = (error as { category: string }).category;
    if (
      (OPENAI_FAILURE_CATEGORIES as readonly string[]).includes(stamped)
    ) {
      const stampedIncomplete =
        "incompleteReason" in error &&
        typeof (error as { incompleteReason: unknown }).incompleteReason ===
          "string"
          ? (error as { incompleteReason: string }).incompleteReason
          : null;
      return {
        category: stamped as OpenAiFailureCategory,
        message:
          stamped === "output_limit"
            ? "OpenAI stopped the critique because the output token limit was reached."
            : message,
        status,
        openaiRequestId,
        code,
        retryable: isRetryableOpenAiCategory(stamped as OpenAiFailureCategory),
        incompleteReason: stampedIncomplete,
      };
    }
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

  const stampedIncompleteReason =
    typeof error === "object" &&
    error !== null &&
    "incompleteReason" in error &&
    typeof (error as { incompleteReason: unknown }).incompleteReason === "string"
      ? (error as { incompleteReason: string }).incompleteReason
      : null;

  if (
    stampedIncompleteReason ||
    /incomplete|max_output|length limit|truncated/i.test(lower)
  ) {
    const reasonMatch = lower.match(
      /\((max_output_tokens|content_filter|[^)]+)\)/i,
    );
    const incompleteReason =
      stampedIncompleteReason ?? reasonMatch?.[1] ?? null;
    const category = categorizeIncompleteReason(incompleteReason);
    return {
      category,
      message:
        category === "output_limit"
          ? "OpenAI stopped the critique because the output token limit was reached."
          : category === "refusal"
            ? "OpenAI refused to generate a critique for this request."
            : "OpenAI returned an incomplete critique response.",
      status: status ?? 502,
      openaiRequestId,
      code: code ?? "invalid_response",
      retryable: false,
      incompleteReason,
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
 * Concise user-facing fallback copy — always names the real failure class.
 * Never claim “OpenAI unavailable” for validation / schema / incomplete / model-param errors.
 */
export function formatFallbackUserMessage(input: {
  category: OpenAiFailureCategory;
  requestId?: string | null;
  audience?: "customer" | "owner";
  failingStage?: string | null;
}): string {
  const id = input.requestId ? ` (request ${input.requestId})` : "";
  const audience = input.audience ?? "customer";

  if (
    audience === "owner" &&
    (input.category === "authentication" ||
      input.category === "quota" ||
      input.category === "provider_unavailable")
  ) {
    return `Atlas could not access the configured OpenAI model${id}. Check the AI runtime settings. Showing a labeled local review instead.`;
  }

  switch (input.category) {
    case "validation":
      return `AI critique failed because the structured response did not satisfy Atlas validation${id}. Showing a labeled local review instead.`;
    case "schema":
      return [
        "AI critique could not run because the response schema was rejected.",
        "Atlas used its local review instead.",
        input.requestId ? `Request ID: ${input.requestId}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "incomplete":
      return `OpenAI returned an incomplete response${id}. Showing a labeled local review instead.`;
    case "output_limit":
      return `AI critique stopped because the model hit its output token limit${id}. Showing a labeled local review instead.`;
    case "refusal":
      return `OpenAI refused to generate a critique for this request${id}. Showing a labeled local review instead.`;
    case "timeout":
      return `The AI critique timed out before OpenAI finished${id}. Showing a labeled local review instead.`;
    case "rate_limit":
      return `OpenAI rate-limited the critique request${id}. Showing a labeled local review instead.`;
    case "model":
      return audience === "owner"
        ? `Atlas could not use the configured OpenAI model parameters${id}. Check the AI runtime settings. Showing a labeled local review instead.`
        : `AI critique failed due to a model configuration issue${id}. Showing a labeled local review instead.`;
    case "authentication":
    case "quota":
      return `Atlas could not authorize the OpenAI critique request${id}. Showing a labeled local review instead.`;
    case "provider_unavailable":
      return `OpenAI is not available in this environment${id}. Showing a labeled local review instead.`;
    case "unknown":
      return input.failingStage === "critique_to_operations"
        ? `AI critique completed, but critique-to-operations failed${id}. Showing a labeled local review instead.`
        : `AI critique failed at ${input.failingStage ?? "an unknown stage"}${id}. Showing a labeled local review instead.`;
    default:
      return `AI critique failed${id}. Showing a labeled local review instead.`;
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
              categorized.category === "incomplete" ||
              categorized.category === "output_limit"
            ? "invalid_response"
            : categorized.category === "provider_unavailable"
              ? "not_configured"
              : "provider_error";

  return new AiError(code, categorized.message, {
    status: categorized.status ?? undefined,
  });
}
