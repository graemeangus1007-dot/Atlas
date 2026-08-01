import { NextResponse } from "next/server";
import { NEW_SITE_AFTER_SIGNUP_HREF } from "@/lib/product/new-site";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback for email confirmation / password recovery links.
 * Signup verification defaults into New Site onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? NEW_SITE_AFTER_SIGNUP_HREF;
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : NEW_SITE_AFTER_SIGNUP_HREF;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
