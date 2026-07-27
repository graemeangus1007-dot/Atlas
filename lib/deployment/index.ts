import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";
import type { DeploymentProvider } from "@/lib/deployment/provider";

export type { DeploymentProvider } from "@/lib/deployment/provider";
export {
  MockDeploymentProvider,
  type MockDeploymentFailStage,
  type MockDeploymentProviderOptions,
} from "@/lib/deployment/mock-provider";
export {
  SupabasePreviewDeploymentProvider,
  type SupabasePreviewDeploymentProviderOptions,
} from "@/lib/deployment/supabase-provider";
export {
  createDeploymentProvider,
  getDeploymentProviderId,
  resolveDeploymentProvider,
  type DeploymentProviderId,
} from "@/lib/deployment/create-provider";
export {
  buildDeploymentId,
  buildDeploymentPreviewUrl,
  toPreviousDeploymentRef,
} from "@/lib/deployment/ids";
export {
  SITE_PREVIEWS_BUCKET,
  buildPreviewObjectPath,
  buildSupabasePreviewUrl,
  collectPreviewUploads,
} from "@/lib/deployment/preview-paths";
export {
  canReusePreviousPreviewUrl,
  isMockPreviewUrl,
  isRealHostedPreviewUrl,
  isSupabaseStoragePreviewUrl,
  isUsableVisitPreviewUrl,
  isVercelPreviewUrl,
  resolveVisitPreviewUrl,
} from "@/lib/deployment/preview-url";
export type { ResolveVisitPreviewInput } from "@/lib/deployment/preview-url";
export {
  isTransientDeploymentError,
  withRetry,
} from "@/lib/deployment/retry";
export type {
  DeploymentError,
  DeploymentErrorCode,
  DeploymentProgressEvent,
  DeploymentRecord,
  DeploymentRequest,
  DeploymentResult,
  DeploymentStatus,
  PreviousDeploymentRef,
} from "@/lib/deployment/types";
export {
  DEPLOYMENT_PROGRESS_STATUSES,
  DEPLOYMENT_STATUS_LABELS,
} from "@/lib/deployment/types";

/**
 * Browser-safe default provider (mock only).
 * Real hosts are selected server-side via DEPLOYMENT_PROVIDER.
 */
export const deploymentProvider: DeploymentProvider =
  new MockDeploymentProvider();
