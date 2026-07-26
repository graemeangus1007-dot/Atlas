import {
  normalizeEmailProviderError,
  redactProviderError,
} from "@/lib/email/errors";
import type {
  EmailProvider,
  SendEmailFailure,
  SendEmailInput,
  SendEmailResult,
  TestConnectionResult,
} from "@/lib/email/types";

const RESEND_API = "https://api.resend.com";

/**
 * Resend.com email provider (production).
 * Requires RESEND_API_KEY — never expose via NEXT_PUBLIC_*.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly id = "resend";
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = (apiKey ?? process.env.RESEND_API_KEY)?.trim();
    if (!key) {
      throw new Error(
        "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
      );
    }
    this.apiKey = key;
  }

  async send(
    input: SendEmailInput,
  ): Promise<SendEmailResult | SendEmailFailure> {
    try {
      const res = await fetch(`${RESEND_API}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(input.idempotencyKey
            ? { "Idempotency-Key": input.idempotencyKey }
            : {}),
        },
        body: JSON.stringify({
          from: input.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          tags: input.tags
            ? Object.entries(input.tags).map(([name, value]) => ({
                name,
                value,
              }))
            : undefined,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };

      if (!res.ok || !body.id) {
        return {
          ok: false,
          provider: this.id,
          error: redactProviderError(
            body.message || `Resend HTTP ${res.status}`,
          ),
          code: body.name || String(res.status),
        };
      }

      return { ok: true, messageId: body.id, provider: this.id };
    } catch (error) {
      const normalized = normalizeEmailProviderError(error, this.id);
      return {
        ok: false,
        provider: this.id,
        error: normalized.error,
        code: normalized.code,
      };
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Lightweight authenticated probe — domains list confirms the key works.
      const res = await fetch(`${RESEND_API}/domains`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        return {
          ok: false,
          provider: this.id,
          error: redactProviderError(
            body.message || `Resend HTTP ${res.status}`,
          ),
        };
      }
      return {
        ok: true,
        provider: this.id,
        message: "Connected to Resend.",
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.id,
        error: normalizeEmailProviderError(error, this.id).error,
      };
    }
  }
}
