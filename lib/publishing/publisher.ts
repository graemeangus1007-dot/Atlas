import { buildPublishUrl } from "@/lib/publishing/build-publish-url";
import { createPublishSnapshot } from "@/lib/publishing/create-publish-snapshot";
import type { BusinessProject } from "@/types/business-project";
import {
  PUBLISH_STEPS,
  type PublishProgressEvent,
  type PublishResult,
  type PublishStepId,
} from "@/types/publishing";

/**
 * Hosting-agnostic publish contract.
 *
 * Swap `MockWebsitePublisher` for a real provider (Vercel, Cloudflare Pages,
 * Netlify, S3+CDN, etc.) without changing dashboard/editor UI.
 */
export interface WebsitePublisher {
  publish(
    project: BusinessProject,
    onProgress?: (event: PublishProgressEvent) => void,
  ): Promise<PublishResult>;
}

const STEP_DURATION_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Mock publisher — simulates a multi-step deploy and returns a fake Atlas URL.
 * No network calls; safe for local demos.
 */
export class MockWebsitePublisher implements WebsitePublisher {
  async publish(
    project: BusinessProject,
    onProgress?: (event: PublishProgressEvent) => void,
  ): Promise<PublishResult> {
    const totalSteps = PUBLISH_STEPS.length;

    for (let index = 0; index < totalSteps; index += 1) {
      const step = PUBLISH_STEPS[index];
      const startProgress = Math.round((index / totalSteps) * 100);
      const endProgress = Math.round(((index + 1) / totalSteps) * 100);

      onProgress?.({
        step: step.id as PublishStepId,
        label: step.label,
        progress: Math.max(startProgress, 4),
      });

      await delay(STEP_DURATION_MS);

      onProgress?.({
        step: step.id as PublishStepId,
        label: step.label,
        progress: endProgress,
      });
    }

    const { slug, url } = buildPublishUrl(project.businessName);

    return {
      slug,
      url,
      publishedAt: new Date().toISOString(),
      snapshot: createPublishSnapshot(project),
    };
  }
}

/** App-wide publisher instance. Replace this export when wiring a real host. */
export const publisher: WebsitePublisher = new MockWebsitePublisher();
