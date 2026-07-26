import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";
import type { DeploymentProvider } from "@/lib/deployment/provider";
import {
  getServerDeploymentProviderId,
  getVercelDeploymentConfig,
  type ServerDeploymentProviderId,
} from "@/lib/deployment/server-config";
import {
  createServerArtifactAssetResolver,
  createServerSupabasePreviewGateway,
} from "@/lib/deployment/server-assets";
import { SupabasePreviewDeploymentProvider } from "@/lib/deployment/supabase-provider";
import { VercelDeploymentProvider } from "@/lib/deployment/vercel-provider";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateServerDeploymentProviderOptions = {
  /** Override DEPLOYMENT_PROVIDER (tests). */
  providerId?: string | null;
  supabase: SupabaseClient;
  userId: string;
};

/**
 * Construct the active deployment provider for server routes.
 * Never import this module from client components.
 */
export function createServerDeploymentProvider(
  options: CreateServerDeploymentProviderOptions,
): DeploymentProvider {
  const id: ServerDeploymentProviderId = getServerDeploymentProviderId(
    options.providerId,
  );

  switch (id) {
    case "vercel": {
      const config = getVercelDeploymentConfig();
      return new VercelDeploymentProvider({
        config,
        assetResolver: createServerArtifactAssetResolver(options.supabase),
      });
    }
    case "supabase":
      return new SupabasePreviewDeploymentProvider({
        gateway: createServerSupabasePreviewGateway(
          options.supabase,
          options.userId,
        ),
      });
    case "mock":
    default:
      return new MockDeploymentProvider();
  }
}

export {
  getServerDeploymentProviderId,
  getDeploymentProviderLabel,
  getDeploymentProviderRecordId,
} from "@/lib/deployment/server-config";
