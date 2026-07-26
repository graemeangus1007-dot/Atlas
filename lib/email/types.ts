/** Email provider contracts (Sprint 17.0B). Server-only. */

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  /** Optional idempotency / correlation key for providers that support it. */
  idempotencyKey?: string;
  tags?: Record<string, string>;
};

export type SendEmailResult = {
  ok: true;
  messageId: string;
  provider: string;
};

export type SendEmailFailure = {
  ok: false;
  provider: string;
  /** Redacted, safe for persistence / owner UI. */
  error: string;
  /** Original provider code when available (never secrets). */
  code?: string;
};

export type TestConnectionResult =
  | { ok: true; provider: string; message: string }
  | { ok: false; provider: string; error: string };

export interface EmailProvider {
  readonly id: string;

  send(
    input: SendEmailInput,
  ): Promise<SendEmailResult | SendEmailFailure>;

  testConnection(): Promise<TestConnectionResult>;
}

export type EmailProviderId = "mock" | "resend";
