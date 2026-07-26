import type {
  DeploymentProgressEvent,
  DeploymentRequest,
  DeploymentResult,
} from "@/lib/deployment/types";

/**
 * Provider-agnostic hosting contract.
 * Swap `MockDeploymentProvider` for Vercel / Netlify / Cloudflare later
 * without changing the publish UI.
 */
export interface DeploymentProvider {
  /** Stable provider id stored on deployment records. */
  readonly id: string;

  deploy(
    request: DeploymentRequest,
    onProgress?: (event: DeploymentProgressEvent) => void,
  ): Promise<DeploymentResult>;
}
