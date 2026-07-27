import { resolveFeatures } from "@/lib/billing/entitlements";
import type { SubscriptionRow } from "@/lib/billing/types";
import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";
import type { DeploymentProvider } from "@/lib/deployment/provider";
import {
  assertReadyDeployment,
  deployViaServerApi,
  fetchActiveDeploymentProvider,
  type ActiveDeploymentProviderInfo,
} from "@/lib/deployment/deploy-client";
import { buildPublishUrl } from "@/lib/publishing/build-publish-url";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { createPublishSnapshot } from "@/lib/publishing/create-publish-snapshot";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProject } from "@/types/business-project";
import {
  PUBLISH_STEPS,
  type PublishProgressEvent,
  type PublishResult,
  type PublishStepId,
} from "@/types/publishing";

async function resolveShowAtlasBranding(
  override?: boolean,
): Promise<boolean> {
  if (typeof override === "boolean") return override;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return true;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!data) return true;
    // Show badge when not entitled to removeBranding (locked or Starter).
    return !resolveFeatures(data as SubscriptionRow).removeBranding;
  } catch {
    return true;
  }
}

/**
 * Hosting-agnostic publish contract.
 * Builds a static artifact, then deploys through {@link DeploymentProvider}
 * or the protected server deployment API.
 */
export interface WebsitePublisher {
  publish(
    project: BusinessProject,
    onProgress?: (event: PublishProgressEvent) => void,
    options?: PublishOptions,
  ): Promise<PublishResult>;
}

export type PublishOptions = {
  /** Force redeploy even when the artifact fingerprint is unchanged. */
  force?: boolean;
  /** Inject an alternate deployment provider (tests). */
  deployment?: DeploymentProvider;
  /** Active Atlas project id (metadata for providers). */
  projectId?: string | null;
  /**
   * preview (default) → atlas-sites. production → linked project (confirmed).
   * Force redeploy is always preview.
   */
  deployTarget?: "preview" | "production";
  /** Typed domain / project name confirmation for production cutover. */
  productionConfirmation?: string | null;
  /** Verified custom domain hostname for SEO canonical / sitemap. */
  activeCustomHostname?: string | null;
  /** Prior preview URL used when no custom domain is active. */
  deploymentPreviewUrl?: string | null;
  /** Override Free-plan Atlas badge (defaults from subscription entitlements). */
  showAtlasBranding?: boolean;
  /**
   * Absolute Atlas origin for contact form endpoints.
   * When omitted, fetched from `/api/app-origin` (server APP_URL).
   */
  atlasOrigin?: string | null;
  /**
   * Inject provider info (tests). When omitted, fetched from
   * `/api/deployment/provider`.
   */
  providerInfo?: ActiveDeploymentProviderInfo;
  /** Inject fetch for deploy API (tests). */
  fetchImpl?: typeof fetch;
};

async function resolveAtlasOriginForPublish(
  options: PublishOptions,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (typeof options.atlasOrigin === "string") {
    return options.atlasOrigin.trim().replace(/\/+$/, "");
  }

  try {
    const response = await fetchImpl("/api/app-origin", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { origin?: unknown };
    return typeof data.origin === "string"
      ? data.origin.trim().replace(/\/+$/, "")
      : "";
  } catch {
    return "";
  }
}

const PREPARE_DELAY_MS = 250;

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emit(
  onProgress: ((event: PublishProgressEvent) => void) | undefined,
  step: PublishStepId,
  progress: number,
  extras?: Partial<PublishProgressEvent>,
): void {
  const label =
    PUBLISH_STEPS.find((item) => item.id === step)?.label ?? step;
  onProgress?.({
    step,
    label,
    progress,
    ...extras,
  });
}

/**
 * Publisher — build static site, deploy via mock or server API, return result.
 * Does not store HTML in the database (callers use `toPublishRecord`).
 */
export class AtlasWebsitePublisher implements WebsitePublisher {
  constructor(private readonly defaultDeployment?: DeploymentProvider) {}

  async publish(
    project: BusinessProject,
    onProgress?: (event: PublishProgressEvent) => void,
    options: PublishOptions = {},
  ): Promise<PublishResult> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const { slug } = buildPublishUrl(project.businessName);

    emit(onProgress, "preparing", 4);
    await delay(PREPARE_DELAY_MS);

    const atlasOrigin = await resolveAtlasOriginForPublish(options, fetchImpl);
    const showAtlasBranding = await resolveShowAtlasBranding(
      options.showAtlasBranding,
    );

    emit(onProgress, "building", 18);
    const artifact = buildStaticSite(project, {
      slug,
      activeCustomHostname: options.activeCustomHostname,
      deploymentPreviewUrl:
        options.deploymentPreviewUrl ??
        project.publish?.deployment?.previewUrl ??
        null,
      atlasOrigin,
      projectId: options.projectId ?? null,
      showAtlasBranding,
    });
    emit(onProgress, "building", 30);

    const previous = project.publish?.deployment
      ? {
          id: project.publish.deployment.id,
          previewUrl: project.publish.deployment.previewUrl,
          artifactFingerprint: project.publish.deployment.artifactFingerprint,
          provider: project.publish.deployment.provider,
          createdAt: project.publish.deployment.createdAt,
          updatedAt: project.publish.deployment.updatedAt,
          readyAt: project.publish.deployment.readyAt,
        }
      : project.publish?.artifactFingerprint
        ? {
            id: `dep_${slug}_${project.publish.artifactFingerprint}`,
            previewUrl: project.publish.url,
            artifactFingerprint: project.publish.artifactFingerprint,
            createdAt: project.publish.publishedAt,
            updatedAt: project.publish.publishedAt,
            readyAt: project.publish.publishedAt,
          }
        : null;

    const mapProgress = (
      event: {
        status: string;
        label: string;
        progress: number;
        deploymentId: string;
      },
    ) => {
      const step = event.status as PublishStepId;
      const mapped = 30 + Math.round((event.progress / 100) * 70);
      emit(onProgress, step, mapped, {
        label: event.label,
        deploymentStatus: event.status as PublishProgressEvent["deploymentStatus"],
        deploymentId: event.deploymentId,
      });
    };

    const injected =
      options.deployment ?? this.defaultDeployment ?? null;

    let deployment;
    if (injected) {
      const deployResult = await injected.deploy(
        {
          projectId: options.projectId ?? null,
          slug,
          artifact,
          previousDeployment: previous,
          force: options.force ?? false,
        },
        mapProgress,
      );
      deployment = assertReadyDeployment(deployResult);
    } else {
      const providerInfo =
        options.providerInfo ??
        (await fetchActiveDeploymentProvider(fetchImpl));

      if (providerInfo.provider === "mock") {
        const mock = new MockDeploymentProvider();
        const deployResult = await mock.deploy(
          {
            projectId: options.projectId ?? null,
            slug,
            artifact,
            previousDeployment: previous,
            force: options.force ?? false,
          },
          mapProgress,
        );
        deployment = assertReadyDeployment(deployResult);
      } else {
        // Real hosts (vercel / supabase) — server-side only.
        const deployResult = await deployViaServerApi(
          {
            projectId: options.projectId ?? null,
            slug,
            artifact,
            previousDeployment: previous,
            force: options.force ?? false,
            deployTarget: options.force
              ? "preview"
              : (options.deployTarget ?? "preview"),
            productionConfirmation: options.force
              ? null
              : (options.productionConfirmation ?? null),
          },
          mapProgress,
          fetchImpl,
        );
        deployment = assertReadyDeployment(deployResult);
      }
    }

    emit(onProgress, "ready", 100, {
      deploymentStatus: "ready",
      deploymentId: deployment.id,
      label: deployment.reused
        ? "Already deployed — no changes to publish"
        : "Deployment ready",
    });

    return {
      slug,
      url: deployment.previewUrl,
      publishedAt: deployment.readyAt ?? new Date().toISOString(),
      snapshot: createPublishSnapshot(project),
      artifact,
      deployment,
    };
  }
}

/** @deprecated Use {@link AtlasWebsitePublisher}. Kept for import compatibility. */
export class MockWebsitePublisher extends AtlasWebsitePublisher {}

/** App-wide publisher instance. */
export const publisher: WebsitePublisher = new AtlasWebsitePublisher();
