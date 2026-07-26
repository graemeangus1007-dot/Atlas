import type {
  DeploymentProgressEvent,
  DeploymentRecord,
  DeploymentRequest,
  DeploymentResult,
  PreviousDeploymentRef,
} from "@/lib/deployment/types";
import type { PublishArtifact } from "@/lib/publishing/types";

export type ActiveDeploymentProviderInfo = {
  /** Env selection: mock | supabase | vercel */
  provider: "mock" | "supabase" | "vercel";
  /** Record id stored on deployments (mock-local | supabase-preview | vercel) */
  id: string;
  label: string;
};

export type DeployViaServerBody = {
  projectId?: string | null;
  slug: string;
  artifact: PublishArtifact;
  previousDeployment?: PreviousDeploymentRef | null;
  force?: boolean;
  /**
   * preview (default) → atlas-sites.
   * production → linked Vercel project only (requires confirmation).
   * Force redeploy is always coerced to preview server-side.
   */
  deployTarget?: "preview" | "production";
  /** Typed domain or linked project name — required for production. */
  productionConfirmation?: string | null;
};

type NdjsonProgress = {
  type: "progress";
  event: DeploymentProgressEvent;
};

type NdjsonResult = {
  type: "result";
  result: DeploymentResult;
};

type NdjsonError = {
  type: "error";
  message: string;
};

/**
 * Fetch the active provider label from the server (no secrets).
 */
export async function fetchActiveDeploymentProvider(
  fetchImpl: typeof fetch = fetch,
): Promise<ActiveDeploymentProviderInfo> {
  const response = await fetchImpl("/api/deployment/provider", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || `Could not load deployment provider (${response.status}).`,
    );
  }

  return (await response.json()) as ActiveDeploymentProviderInfo;
}

/**
 * Deploy a built artifact through the protected server route.
 * Streams NDJSON progress events, then a final result.
 */
export async function deployViaServerApi(
  body: DeployViaServerBody,
  onProgress?: (event: DeploymentProgressEvent) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<DeploymentResult> {
  const response = await fetchImpl("/api/deployment/deploy", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body satisfies DeployViaServerBody),
  });

  if (!response.ok) {
    let message = `Deployment request failed (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      message = data.error || data.message || message;
    } catch {
      // keep default
    }
    return {
      ok: false,
      error: {
        code: "provider_error",
        message,
        retryable: response.status >= 500 || response.status === 429,
      },
    };
  }

  if (!response.body) {
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Deployment response stream was empty.",
        retryable: true,
      },
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: DeploymentResult | null = null;

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: NdjsonProgress | NdjsonResult | NdjsonError;
    try {
      parsed = JSON.parse(trimmed) as NdjsonProgress | NdjsonResult | NdjsonError;
    } catch {
      return;
    }

    if (parsed.type === "progress") {
      onProgress?.(parsed.event);
    } else if (parsed.type === "result") {
      finalResult = parsed.result;
    } else if (parsed.type === "error") {
      finalResult = {
        ok: false,
        error: {
          code: "provider_error",
          message: parsed.message,
          retryable: true,
        },
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consumeLine(buffer);
  }

  if (!finalResult) {
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "Deployment ended without a result.",
        retryable: true,
      },
    };
  }

  return finalResult;
}

/** Narrow helper for callers that only need a ready deployment. */
export function assertReadyDeployment(
  result: DeploymentResult,
): DeploymentRecord {
  if (!result.ok) {
    throw new Error(
      result.error.message ?? "Deployment failed. Please try again.",
    );
  }
  const deployment = result.deployment;
  if (deployment.status !== "ready") {
    throw new Error(
      deployment.error?.message ?? "Deployment did not reach ready state.",
    );
  }
  if (!deployment.previewUrl) {
    throw new Error(
      "Deployment succeeded but no preview URL was returned by the provider.",
    );
  }
  return deployment;
}

/** Build a DeploymentRequest-shaped payload for the server API. */
export function toDeployViaServerBody(
  request: DeploymentRequest,
): DeployViaServerBody {
  return {
    projectId: request.projectId ?? null,
    slug: request.slug,
    artifact: request.artifact,
    previousDeployment: request.previousDeployment ?? null,
    force: request.force ?? false,
    deployTarget: request.deployTarget ?? "preview",
    productionConfirmation: request.productionConfirmation ?? null,
  };
}
