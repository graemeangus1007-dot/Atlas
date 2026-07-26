import { withRetry, isTransientDeploymentError } from "@/lib/deployment/retry";
import { redactSecrets } from "@/lib/deployment/server-config";
import {
  assertCreateDeploymentBodyWithinLimit,
  type VercelFileReference,
} from "@/lib/deployment/vercel-files";
import type { VercelCreateStaticDeploymentBody } from "@/lib/deployment/vercel-static-deployment";

const VERCEL_API_BASE = "https://api.vercel.com";

export type VercelCreateDeploymentBody = VercelCreateStaticDeploymentBody & {
  /** Omit / null → preview deployment. */
  target?: "production" | "staging" | null;
};

export type VercelDeploymentReadyState =
  | "QUEUED"
  | "INITIALIZING"
  | "BUILDING"
  | "UPLOADING"
  | "DEPLOYING"
  | "READY"
  | "ERROR"
  | "CANCELED"
  | "DELETED"
  | string;

export type VercelDeploymentResponse = {
  id: string;
  url?: string;
  name?: string;
  readyState?: VercelDeploymentReadyState;
  readyStateReason?: string;
  error?: { code?: string; message?: string };
};

export type VercelUploadFileInput = {
  sha: string;
  size: number;
  bytes: Uint8Array;
};

export type VercelApiClientOptions = {
  token: string;
  teamId?: string;
  fetchImpl?: typeof fetch;
  apiBase?: string;
};

export type VercelApiClient = {
  /**
   * Upload raw file bytes to POST /v2/files.
   * Identical SHA uploads are reused by Vercel (200 / already present).
   */
  uploadFile(input: VercelUploadFileInput): Promise<void>;
  createDeployment(
    body: VercelCreateDeploymentBody,
  ): Promise<VercelDeploymentResponse>;
  getDeployment(idOrUrl: string): Promise<VercelDeploymentResponse>;
};

function teamQuery(
  teamId?: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(extra);
  if (teamId) params.set("teamId", teamId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function safeErrorMessage(status: number, bodyText: string, token: string): string {
  const redacted = redactSecrets(bodyText, token);
  let apiMessage = redacted.slice(0, 280);
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string };
      message?: string;
    };
    apiMessage = parsed.error?.message || parsed.message || apiMessage;
  } catch {
    // keep redacted body slice
  }
  return redactSecrets(
    `Vercel API error (${status}): ${apiMessage || "Request failed."}`,
    token,
  );
}

/**
 * Thin Vercel REST client (file upload + Deployments API).
 * Server-only — never import from client components.
 */
export function createVercelApiClient(
  options: VercelApiClientOptions,
): VercelApiClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBase = (options.apiBase ?? VERCEL_API_BASE).replace(/\/+$/, "");
  const { token, teamId } = options;

  async function requestJson(
    path: string,
    init?: RequestInit,
  ): Promise<VercelDeploymentResponse> {
    const response = await withRetry(
      async () => {
        const res = await fetchImpl(`${apiBase}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
        });

        if (res.status === 429 || res.status >= 500) {
          const text = await res.text();
          const err = new Error(safeErrorMessage(res.status, text, token)) as Error & {
            status: number;
          };
          err.status = res.status;
          throw err;
        }

        return res;
      },
      {
        retries: 3,
        baseDelayMs: 400,
        shouldRetry: isTransientDeploymentError,
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(safeErrorMessage(response.status, text, token));
    }

    try {
      return JSON.parse(text) as VercelDeploymentResponse;
    } catch {
      throw new Error("Vercel API returned an invalid JSON response.");
    }
  }

  return {
    async uploadFile(input) {
      await withRetry(
        async () => {
          const res = await fetchImpl(`${apiBase}/v2/files${teamQuery(teamId)}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/octet-stream",
              "Content-Length": String(input.size),
              "x-vercel-digest": input.sha,
              "x-now-digest": input.sha,
              "x-now-size": String(input.size),
            },
            // Body is raw bytes — never base64 / JSON.
            body: Buffer.from(input.bytes),
          });

          if (res.status === 429 || res.status >= 500) {
            const text = await res.text();
            const err = new Error(
              safeErrorMessage(res.status, text, token),
            ) as Error & { status: number };
            err.status = res.status;
            throw err;
          }

          if (!res.ok) {
            const text = await res.text();
            throw new Error(safeErrorMessage(res.status, text, token));
          }

          // 200 with empty / {} body means uploaded or already present (SHA reuse).
          return;
        },
        {
          retries: 3,
          baseDelayMs: 400,
          shouldRetry: isTransientDeploymentError,
        },
      );
    },

    createDeployment(body) {
      assertCreateDeploymentBodyWithinLimit(body);
      // Skip framework auto-detection confirmation when the target project
      // was previously configured as Next.js (customer sites are static).
      return requestJson(
        `/v13/deployments${teamQuery(teamId, {
          skipAutoDetectionConfirmation: "1",
        })}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },

    getDeployment(idOrUrl) {
      const id = encodeURIComponent(idOrUrl);
      return requestJson(`/v13/deployments/${id}${teamQuery(teamId)}`, {
        method: "GET",
      });
    },
  };
}

export function toHttpsDeploymentUrl(urlOrHost: string): string {
  const trimmed = urlOrHost.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function isTerminalVercelState(state: string | undefined): boolean {
  const s = (state ?? "").toUpperCase();
  return s === "READY" || s === "ERROR" || s === "CANCELED" || s === "DELETED";
}
