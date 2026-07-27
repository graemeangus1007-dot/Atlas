import { ConsoleMonitoringProvider } from "@/lib/monitoring/console-provider";
import { redactSecrets, redactSecretsDeep } from "@/lib/monitoring/redact";
import type {
  CaptureExceptionInput,
  CaptureMessageInput,
  MonitoringProvider,
} from "@/lib/monitoring/types";

/**
 * Sentry-ready adapter.
 *
 * Does not depend on `@sentry/nextjs` yet — when SENTRY_DSN is set and a
 * global `Sentry` bridge is installed, events are forwarded. Otherwise falls
 * back to the console provider so local/dev never requires Sentry.
 */
type SentryLike = {
  captureException: (
    error: unknown,
    hint?: { captureContext?: Record<string, unknown> },
  ) => void;
  captureMessage: (
    message: string,
    captureContext?: Record<string, unknown>,
  ) => void;
};

function getSentryBridge(): SentryLike | null {
  const g = globalThis as typeof globalThis & { Sentry?: SentryLike };
  return g.Sentry ?? null;
}

export class SentryReadyMonitoringProvider implements MonitoringProvider {
  readonly name = "sentry-ready";
  private readonly fallback = new ConsoleMonitoringProvider();

  captureException(input: CaptureExceptionInput): void {
    const sentry = getSentryBridge();
    if (!sentry || !process.env.SENTRY_DSN?.trim()) {
      this.fallback.captureException(input);
      return;
    }

    try {
      sentry.captureException(input.error, {
        captureContext: {
          level: input.level ?? "error",
          tags: input.context?.tags,
          user: input.context?.user
            ? { id: input.context.user.id ?? undefined }
            : undefined,
          extra: input.context
            ? redactSecretsDeep({
                request: input.context.request,
                project: input.context.project,
                extra: input.context.extra,
              })
            : undefined,
        },
      });
    } catch {
      this.fallback.captureException(input);
    }
  }

  captureMessage(input: CaptureMessageInput): void {
    const sentry = getSentryBridge();
    if (!sentry || !process.env.SENTRY_DSN?.trim()) {
      this.fallback.captureMessage(input);
      return;
    }

    try {
      sentry.captureMessage(redactSecrets(input.message), {
        level: input.level ?? "info",
        tags: input.context?.tags,
        extra: input.context
          ? redactSecretsDeep({
              request: input.context.request,
              project: input.context.project,
              extra: input.context.extra,
            })
          : undefined,
      });
    } catch {
      this.fallback.captureMessage(input);
    }
  }
}
