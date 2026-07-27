import { redactSecrets, redactSecretsDeep } from "@/lib/monitoring/redact";
import type {
  CaptureExceptionInput,
  CaptureMessageInput,
  MonitoringProvider,
} from "@/lib/monitoring/types";

function errorToSafeMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(`${error.name}: ${error.message}`);
  }
  return redactSecrets(String(error));
}

/** Local / default monitoring provider — structured console output only. */
export class ConsoleMonitoringProvider implements MonitoringProvider {
  readonly name = "console";

  captureException(input: CaptureExceptionInput): void {
    const payload = {
      type: "exception",
      level: input.level ?? "error",
      message: errorToSafeMessage(input.error),
      context: input.context
        ? redactSecretsDeep(input.context)
        : undefined,
    };
    console.error("[atlas.monitor]", JSON.stringify(payload));
  }

  captureMessage(input: CaptureMessageInput): void {
    const payload = {
      type: "message",
      level: input.level ?? "info",
      message: redactSecrets(input.message),
      context: input.context
        ? redactSecretsDeep(input.context)
        : undefined,
    };
    if (input.level === "error" || input.level === "fatal") {
      console.error("[atlas.monitor]", JSON.stringify(payload));
    } else if (input.level === "warning") {
      console.warn("[atlas.monitor]", JSON.stringify(payload));
    } else {
      console.info("[atlas.monitor]", JSON.stringify(payload));
    }
  }
}
