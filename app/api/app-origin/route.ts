import {
  getPublishableAtlasOrigin,
  resolvePublicAppUrl,
  validateAppUrlAtStartup,
} from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/app-origin
 * Returns the server-resolved public Atlas origin for published form POSTs.
 * Auth required — used by the editor publisher (client build).
 */
export async function GET() {
  validateAppUrlAtStartup();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = resolvePublicAppUrl();
  const origin = getPublishableAtlasOrigin();

  return Response.json({
    origin,
    source: resolved?.source ?? null,
    isLocalhost: resolved?.isLocalhost ?? false,
  });
}
