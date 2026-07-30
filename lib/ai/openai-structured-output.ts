/**
 * Responses API structured-output helpers (Sprint 28.0B).
 * Prefer reading structured JSON items over fragile convenience strings.
 */

import { AiError } from "@/lib/ai/errors";
import type OpenAI from "openai";

/** Keywords OpenAI strict Structured Outputs often reject. */
const STRIP_KEYS = new Set([
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "multipleOf",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "oneOf",
  "anyOf",
  "allOf",
  "$ref",
  "$defs",
  "definitions",
  "nullable",
]);

/**
 * Deep-clone a JSON schema for the OpenAI wire format by stripping
 * unsupported validation keywords. Atlas runtime validators remain authoritative.
 */
export function toOpenAiStrictSchema(schema: unknown): Record<string, unknown> {
  if (Array.isArray(schema)) {
    return schema.map((item) => toOpenAiStrictSchema(item)) as unknown as Record<
      string,
      unknown
    >;
  }
  if (!schema || typeof schema !== "object") {
    return schema as Record<string, unknown>;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (STRIP_KEYS.has(key)) continue;
    if (value && typeof value === "object") {
      out[key] = toOpenAiStrictSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export type StructuredOutputStatus =
  | "completed"
  | "incomplete"
  | "failed"
  | "refusal"
  | "empty";

export type ExtractedStructuredJson = {
  status: StructuredOutputStatus;
  /** Parsed JSON when available. */
  json: unknown | null;
  refusalMessage: string | null;
  incompleteReason: string | null;
};

function tryParseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed || /^```/m.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Extract structured JSON from a Responses API result.
 * Handles completed / incomplete / failed / refusal / empty.
 */
export function extractStructuredJsonFromResponse(
  response: OpenAI.Responses.Response,
): ExtractedStructuredJson {
  const status = String(response.status ?? "completed");

  // Refusal items
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      type?: string;
      refusal?: string;
      content?: Array<{ type?: string; refusal?: string; text?: string; json?: unknown }>;
    };
    if (row.type === "refusal" && typeof row.refusal === "string") {
      return {
        status: "refusal",
        json: null,
        refusalMessage: row.refusal,
        incompleteReason: null,
      };
    }
    if (Array.isArray(row.content)) {
      for (const part of row.content) {
        if (part?.type === "refusal" && typeof part.refusal === "string") {
          return {
            status: "refusal",
            json: null,
            refusalMessage: part.refusal,
            incompleteReason: null,
          };
        }
        // Prefer native structured JSON parts when present
        if (part && "json" in part && part.json !== undefined) {
          return {
            status: status === "incomplete" ? "incomplete" : "completed",
            json: part.json,
            refusalMessage: null,
            incompleteReason:
              status === "incomplete"
                ? String(
                    (response as { incomplete_details?: { reason?: string } })
                      .incomplete_details?.reason ?? "incomplete",
                  )
                : null,
          };
        }
        // Message output_text parts (gpt-5 / Responses)
        if (
          (part?.type === "output_text" || part?.type === "text") &&
          typeof part.text === "string" &&
          part.text.trim()
        ) {
          const parsedPart = tryParseJson(part.text);
          if (parsedPart !== null) {
            return {
              status: status === "incomplete" ? "incomplete" : "completed",
              json: parsedPart,
              refusalMessage: null,
              incompleteReason:
                status === "incomplete"
                  ? String(
                      (response as { incomplete_details?: { reason?: string } })
                        .incomplete_details?.reason ?? "incomplete",
                    )
                  : null,
            };
          }
        }
      }
    }
  }

  if (status === "failed") {
    return {
      status: "failed",
      json: null,
      refusalMessage: null,
      incompleteReason: null,
    };
  }

  // Convenience output_text (may be empty even when structured items exist)
  const text =
    typeof response.output_text === "string" ? response.output_text : "";
  const parsed = text.trim() ? tryParseJson(text) : null;

  if (status === "incomplete") {
    return {
      status: "incomplete",
      json: parsed,
      refusalMessage: null,
      incompleteReason: String(
        (response as { incomplete_details?: { reason?: string } })
          .incomplete_details?.reason ?? "incomplete",
      ),
    };
  }

  if (parsed !== null) {
    return {
      status: "completed",
      json: parsed,
      refusalMessage: null,
      incompleteReason: null,
    };
  }

  return {
    status: "empty",
    json: null,
    refusalMessage: null,
    incompleteReason: null,
  };
}

/** Map extraction result to an AiError with a distinct category-friendly message. */
export function errorFromStructuredExtraction(
  extracted: ExtractedStructuredJson,
): AiError {
  switch (extracted.status) {
    case "refusal": {
      const err = new AiError(
        "invalid_response",
        "OpenAI refused to generate structured critique output.",
      );
      (err as AiError & { category?: string }).category = "refusal";
      return err;
    }
    case "incomplete": {
      const reason = extracted.incompleteReason ?? "incomplete";
      const isOutputLimit = /max_output_tokens|max_tokens|output_token/i.test(
        reason,
      );
      const err = new AiError(
        "invalid_response",
        isOutputLimit
          ? `OpenAI returned an incomplete critique response (${reason}).`
          : `OpenAI returned an incomplete critique response${
              extracted.incompleteReason ? ` (${extracted.incompleteReason})` : ""
            }.`,
      );
      (err as AiError & { category?: string; incompleteReason?: string }).category =
        isOutputLimit ? "output_limit" : "incomplete";
      (err as AiError & { incompleteReason?: string }).incompleteReason = reason;
      return err;
    }
    case "failed":
      return new AiError(
        "provider_error",
        "OpenAI critique response failed.",
      );
    case "empty":
      return new AiError(
        "invalid_response",
        "OpenAI returned no JSON content.",
      );
    default:
      return new AiError(
        "invalid_response",
        "OpenAI returned no usable structured output.",
      );
  }
}
