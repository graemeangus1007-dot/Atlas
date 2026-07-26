import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDeploymentProviderLabel,
  getDeploymentProviderRecordId,
  getServerDeploymentProviderId,
} from "@/lib/deployment/server-config";

export const runtime = "nodejs";

/**
 * GET /api/deployment/provider
 * Returns the active hosting provider label (no secrets).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getServerDeploymentProviderId();
  return NextResponse.json({
    provider,
    id: getDeploymentProviderRecordId(provider),
    label: getDeploymentProviderLabel(provider),
  });
}
