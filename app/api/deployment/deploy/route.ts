import {
  getPublishableAtlasOrigin,
  isLocalhostOrigin,
} from "@/lib/app-url";
import { badRequest, getRequestId, unauthorized } from "@/lib/api";
import { createServerDeploymentProvider } from "@/lib/deployment/create-provider.server";
import type { DeployViaServerBody } from "@/lib/deployment/deploy-client";
import {
  getServerDeploymentProviderId,
  redactSecrets,
} from "@/lib/deployment/server-config";
import { resolveVercelDeployProjectId } from "@/lib/domains/resolve-deploy-project";
import type { DeployTarget } from "@/lib/domains/production-publish";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";
import { rewritePublishedFormOrigins } from "@/lib/publishing/rewrite-form-origin";
import type { PublishArtifact } from "@/lib/publishing/types";
import type { PreviousDeploymentRef } from "@/lib/deployment/types";

export const runtime = "nodejs";
/** Keep in sync with DEPLOYMENT_ROUTE_MAX_DURATION_SECONDS in lib/deployment/limits.ts */
export const maxDuration = 120;

function isPublishArtifact(value: unknown): value is PublishArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as PublishArtifact;
  return (
    artifact.version === 1 &&
    typeof artifact.slug === "string" &&
    typeof artifact.fingerprint === "string" &&
    Array.isArray(artifact.files) &&
    artifact.files.length > 0 &&
    Array.isArray(artifact.assets)
  );
}

function parseDeployTarget(raw: unknown): DeployTarget {
  return raw === "production" ? "production" : "preview";
}

function parseBody(raw: unknown): DeployViaServerBody | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as DeployViaServerBody;
  if (typeof body.slug !== "string" || !body.slug.trim()) return null;
  if (!isPublishArtifact(body.artifact)) return null;

  const force = Boolean(body.force);
  // Force Redeploy / normal Publish can never target linked production.
  const requestedTarget = parseDeployTarget(body.deployTarget);
  const deployTarget: DeployTarget =
    force || requestedTarget !== "production" ? "preview" : "production";

  return {
    projectId: body.projectId ?? null,
    slug: body.slug.trim(),
    artifact: body.artifact,
    previousDeployment: (body.previousDeployment ??
      null) as PreviousDeploymentRef | null,
    force,
    deployTarget,
    productionConfirmation:
      typeof body.productionConfirmation === "string"
        ? body.productionConfirmation
        : null,
  };
}

/**
 * POST /api/deployment/deploy
 * Accepts a static publish artifact and deploys via the server-selected provider.
 * Streams NDJSON progress events, then a final result.
 * Vercel credentials never leave the server.
 *
 * Safety: default + force always deploy to atlas-sites preview project.
 * Linked production requires deployTarget=production + typed confirmation.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorized(requestId);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Invalid JSON body.", requestId, "invalid_json");
  }

  const body = parseBody(raw);
  if (!body) {
    return badRequest(
      "Invalid deployment payload. Expected slug + publish artifact.",
      requestId,
      "invalid_deploy_payload",
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const provider = createServerDeploymentProvider({
          supabase,
          userId: user.id,
        });

        let vercelProjectId: string | null = null;
        if (getServerDeploymentProviderId() === "vercel") {
          const resolved = await resolveVercelDeployProjectId({
            supabase,
            ownerId: user.id,
            atlasProjectId: body.projectId,
            target: body.deployTarget ?? "preview",
            productionConfirmation: body.productionConfirmation,
          });

          if (!resolved.ok) {
            send({ type: "error", message: resolved.message });
            return;
          }

          vercelProjectId = resolved.vercelProjectId;
        }

        // Never ship localhost form/analytics endpoints to preview/production hosts.
        const atlasOrigin = getPublishableAtlasOrigin();
        const artifact = rewritePublishedFormOrigins(body.artifact, atlasOrigin);

        const html = artifact.files.find((f) => f.path === "index.html")?.content;
        const hasLocalhostAtlasEndpoint =
          typeof html === "string" &&
          /https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(html) &&
          (/\/api\/forms\//.test(html) || /\/api\/analytics\/collect/.test(html));

        if (
          hasLocalhostAtlasEndpoint &&
          getServerDeploymentProviderId() === "vercel" &&
          (!atlasOrigin || isLocalhostOrigin(atlasOrigin))
        ) {
          send({
            type: "error",
            message:
              "Published site still targets localhost for forms or analytics. Set APP_URL to your deployed Atlas origin (e.g. https://your-atlas-app.vercel.app), then publish again.",
          });
          return;
        }

        const result = await provider.deploy(
          {
            projectId: body.projectId,
            vercelProjectId,
            slug: body.slug,
            artifact,
            previousDeployment: body.previousDeployment,
            force: body.force,
          },
          (event) => {
            send({ type: "progress", event });
          },
        );

        send({ type: "result", result });
      } catch (err) {
        const token = process.env.VERCEL_TOKEN;
        const message = redactSecrets(
          err instanceof Error ? err.message : "Deployment failed.",
          token,
        );
        captureException({
          error: err,
          context: {
            request: requestContextFromRequest(request, requestId),
            user: { id: user.id },
            project: { projectId: body.projectId },
            tags: { route: "deployment.deploy" },
          },
        });
        send({
          type: "error",
          code: "deploy_failed",
          message,
          requestId,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "x-request-id": requestId,
    },
  });
}
