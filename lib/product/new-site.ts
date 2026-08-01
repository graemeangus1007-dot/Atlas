/**
 * Single website creation entry — Atlas-guided onboarding.
 * All “New Site” / primary create CTAs must use this path.
 */

export const NEW_SITE_HREF = "/onboarding" as const;
export const NEW_SITE_LABEL = "New Site" as const;

/** Post-auth default for brand-new accounts starting a site. */
export const NEW_SITE_AFTER_SIGNUP_HREF = NEW_SITE_HREF;

/** Product home after login when no explicit `next` is provided. */
export const DEFAULT_SIGNED_IN_HREF = "/projects" as const;
