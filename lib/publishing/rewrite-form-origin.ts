import { isLocalhostOrigin } from "@/lib/app-url";
import { fingerprintFiles } from "@/lib/publishing/fingerprint";
import type { PublishArtifact } from "@/lib/publishing/types";

const LOCALHOST_ORIGIN_IN_HTML =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/gi;

/**
 * Replace localhost Atlas origins in published HTML with the configured
 * public APP_URL. Recomputes fingerprint when content changes.
 *
 * No-op when the target origin is missing or itself localhost.
 */
export function rewritePublishedFormOrigins(
  artifact: PublishArtifact,
  atlasOrigin: string | null | undefined,
): PublishArtifact {
  const origin = atlasOrigin?.trim().replace(/\/+$/, "") || "";
  if (!origin || isLocalhostOrigin(origin)) {
    return artifact;
  }

  let changed = false;
  const files = artifact.files.map((file) => {
    if (!file.path.endsWith(".html") && file.path !== "atlas-manifest.json") {
      return file;
    }
    const content = file.content.replace(LOCALHOST_ORIGIN_IN_HTML, origin);
    if (content !== file.content) changed = true;
    return content === file.content ? file : { ...file, content };
  });

  if (!changed) return artifact;

  return {
    ...artifact,
    files,
    fingerprint: fingerprintFiles(files),
  };
}
