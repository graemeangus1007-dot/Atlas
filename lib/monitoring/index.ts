import { ConsoleMonitoringProvider } from "@/lib/monitoring/console-provider";
import { SentryReadyMonitoringProvider } from "@/lib/monitoring/sentry-provider";
import type {
  CaptureExceptionInput,
  CaptureMessageInput,
  MonitoringContext,
  MonitoringProvider,
} from "@/lib/monitoring/types";

export type {
  CaptureExceptionInput,
  CaptureMessageInput,
  MonitoringContext,
  MonitoringLevel,
  MonitoringProvider,
  MonitoringProjectContext,
  MonitoringRequestContext,
  MonitoringUserContext,
} from "@/lib/monitoring/types";
export { redactSecrets, redactSecretsDeep } from "@/lib/monitoring/redact";
export { ConsoleMonitoringProvider } from "@/lib/monitoring/console-provider";
export { SentryReadyMonitoringProvider } from "@/lib/monitoring/sentry-provider";

let provider: MonitoringProvider | null = null;

function resolveProvider(): MonitoringProvider {
  if (provider) return provider;
  if (process.env.SENTRY_DSN?.trim()) {
    provider = new SentryReadyMonitoringProvider();
  } else {
    provider = new ConsoleMonitoringProvider();
  }
  return provider;
}

/** Override provider (tests). */
export function setMonitoringProvider(next: MonitoringProvider | null): void {
  provider = next;
}

export function captureException(input: CaptureExceptionInput): void {
  resolveProvider().captureException(input);
}

export function captureMessage(input: CaptureMessageInput): void {
  resolveProvider().captureMessage(input);
}

/** Build request context from a Fetch API Request. */
export function requestContextFromRequest(
  request: Request,
  requestId?: string,
): MonitoringContext["request"] {
  let path = "/";
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = "/";
  }
  return {
    requestId: requestId ?? request.headers.get("x-request-id"),
    method: request.method,
    path,
  };
}
