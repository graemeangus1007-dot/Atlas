import type {
  EmailProvider,
  SendEmailFailure,
  SendEmailInput,
  SendEmailResult,
  TestConnectionResult,
} from "@/lib/email/types";
import { redactProviderError } from "@/lib/email/errors";

export type MockEmailSendRecord = SendEmailInput & {
  messageId: string;
  sentAt: string;
};

type MockEmailProviderOptions = {
  /** When true, send() fails with a redacted error (tests). */
  failNext?: boolean;
  failMessage?: string;
};

/**
 * In-memory email provider for local development and unit tests.
 * Never calls external networks.
 */
export class MockEmailProvider implements EmailProvider {
  readonly id = "mock";
  readonly sent: MockEmailSendRecord[] = [];
  private failNext: boolean;
  private failMessage: string;
  private seq = 0;

  constructor(options: MockEmailProviderOptions = {}) {
    this.failNext = Boolean(options.failNext);
    this.failMessage = options.failMessage || "Mock email provider failure.";
  }

  setFailNext(fail: boolean, message?: string) {
    this.failNext = fail;
    if (message) this.failMessage = message;
  }

  clear() {
    this.sent.length = 0;
    this.seq = 0;
    this.failNext = false;
  }

  async send(
    input: SendEmailInput,
  ): Promise<SendEmailResult | SendEmailFailure> {
    if (this.failNext) {
      this.failNext = false;
      return {
        ok: false,
        provider: this.id,
        error: redactProviderError(this.failMessage),
        code: "mock_failure",
      };
    }

    this.seq += 1;
    const messageId = `mock_${Date.now()}_${this.seq}`;
    this.sent.push({
      ...input,
      messageId,
      sentAt: new Date().toISOString(),
    });

    return { ok: true, messageId, provider: this.id };
  }

  async testConnection(): Promise<TestConnectionResult> {
    if (this.failNext) {
      this.failNext = false;
      return {
        ok: false,
        provider: this.id,
        error: redactProviderError(this.failMessage),
      };
    }
    return {
      ok: true,
      provider: this.id,
      message: "Mock email provider is ready.",
    };
  }
}
