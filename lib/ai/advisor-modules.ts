/**
 * Built-in Business Advisor modules (Sprint 23.0A).
 * Register additional modules (Performance, Analytics, …) via createAdvisorPipeline.
 */

import { contrastRatio, meetsWcagAa } from "@/lib/ai/contrast";
import type {
  AdvisorFinding,
  AdvisorModule,
} from "@/lib/ai/business-advisor-types";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "@/lib/seo/types";

function phoneLooksWeak(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 7;
}

function ctaLooksWeak(cta: string): boolean {
  const t = cta.trim().toLowerCase();
  if (!t) return true;
  return (
    t === "learn more" ||
    t === "click here" ||
    t === "submit" ||
    t === "ok" ||
    t.length < 3
  );
}

export const conversionAdvisor: AdvisorModule = {
  id: "conversion",
  label: "Conversion Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const { project } = ctx;
    const phone = project.contact.phone?.trim() || "";

    if (phone && !/call|phone|tel/i.test(project.heroSubheadline + project.primaryCta)) {
      findings.push({
        id: "conversion.phone-in-hero",
        category: "conversion",
        title: "Make your phone number visible in the hero",
        why: "Visitors should immediately know how to contact you.",
        impact: "high",
        impactScore: 92,
        confidence: 0.9,
        operations: [
          {
            operation: "replaceText",
            target: "hero.subheadline",
            value: `${project.heroSubheadline.trim() || `Work with ${project.businessName}`} — call ${phone}.`,
          },
          {
            operation: "replaceText",
            target: "hero.primaryCta",
            value: "Call now",
          },
        ],
      });
    }

    if (phoneLooksWeak(phone)) {
      findings.push({
        id: "conversion.missing-phone",
        category: "conversion",
        title: "Add a clear contact phone number",
        why: "Without a reachable number, visitors who are ready to buy often leave.",
        impact: "high",
        impactScore: 88,
        confidence: 0.86,
        operations: [
          {
            operation: "replaceText",
            target: "contact.description",
            value: `Reach ${project.businessName || "us"} by phone or message — we typically reply within one business day.`,
          },
        ],
      });
    }

    return findings;
  },
};

export const ctaAdvisor: AdvisorModule = {
  id: "cta",
  label: "CTA Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    if (ctaLooksWeak(ctx.project.primaryCta)) {
      findings.push({
        id: "cta.weak-primary",
        category: "cta_effectiveness",
        title: "Strengthen your primary call to action",
        why: "Vague buttons like “Learn more” rarely convert as well as a clear next step.",
        impact: "high",
        impactScore: 90,
        confidence: 0.88,
        operations: [
          {
            operation: "replaceText",
            target: "hero.primaryCta",
            value: "Get started",
          },
        ],
      });
    }
    const button = ctx.project.contact.buttonText?.trim() || "";
    if (!button || /submit|send|ok/i.test(button)) {
      findings.push({
        id: "cta.weak-contact",
        category: "cta_effectiveness",
        title: "Improve the contact form button label",
        why: "A specific action label tells visitors exactly what happens next.",
        impact: "medium",
        impactScore: 70,
        confidence: 0.82,
        operations: [
          {
            operation: "replaceText",
            target: "contact.buttonText",
            value: "Send message",
          },
        ],
      });
    }
    return findings;
  },
};

export const trustAdvisor: AdvisorModule = {
  id: "trust",
  label: "Trust Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const enabled = ctx.project.designSections?.enabled ?? [];
    const hasTestimonials =
      enabled.includes("testimonials") &&
      (ctx.project.designSections?.testimonials?.length ?? 0) > 0;

    if (!hasTestimonials) {
      findings.push({
        id: "trust.testimonials",
        category: "trust",
        title: "Add testimonials",
        why: "Builds trust before visitors decide to call.",
        impact: "high",
        impactScore: 91,
        confidence: 0.9,
        operations: [{ operation: "insertSection", type: "testimonials" }],
      });
    }

    if ((ctx.project.description?.trim().length || 0) < 80) {
      findings.push({
        id: "trust.about-thin",
        category: "trust",
        title: "Expand your About section",
        why: "A fuller story helps visitors feel confident they’re choosing the right business.",
        impact: "medium",
        impactScore: 68,
        confidence: 0.8,
        operations: [
          {
            operation: "replaceText",
            target: "about.body",
            value: `${ctx.project.businessName || "We"} focus on clear communication, reliable delivery, and a customer experience people are happy to recommend.`,
          },
        ],
      });
    }

    return findings;
  },
};

export const sectionsAdvisor: AdvisorModule = {
  id: "sections",
  label: "Sections Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const enabled = ctx.project.designSections?.enabled ?? [];
    if (!enabled.includes("faq")) {
      findings.push({
        id: "sections.faq",
        category: "missing_sections",
        title: "Add an FAQ section",
        why: "Answering common questions early reduces hesitation and support friction.",
        impact: "medium",
        impactScore: 72,
        confidence: 0.84,
        operations: [{ operation: "insertSection", type: "faq" }],
      });
    }
    return findings;
  },
};

export const seoAdvisor: AdvisorModule = {
  id: "seo",
  label: "SEO Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const seo = ctx.project.seo;
    const title = seo?.siteTitle?.trim() || "";
    const description = seo?.metaDescription?.trim() || "";

    if (!title || title === ctx.project.businessName || title.length < 12) {
      findings.push({
        id: "seo.weak-title",
        category: "seo",
        title: "Improve your SEO site title",
        why: "A clearer search title helps the right visitors find you.",
        impact: "high",
        impactScore: 86,
        confidence: 0.87,
        operations: [
          {
            operation: "updateSeo",
            siteTitle: `${ctx.project.businessName || "Website"} | Official Site`.slice(
              0,
              SEO_TITLE_MAX,
            ),
          },
        ],
      });
    }

    if (!description || description.length < 70) {
      findings.push({
        id: "seo.weak-description",
        category: "seo",
        title: "Write a stronger meta description",
        why: "Search snippets that explain your offer earn more qualified clicks.",
        impact: "medium",
        impactScore: 74,
        confidence: 0.85,
        operations: [
          {
            operation: "updateSeo",
            metaDescription: (
              ctx.project.description.trim() ||
              `${ctx.project.businessName || "We"} provides trusted service with a clear process and friendly support.`
            ).slice(0, SEO_DESCRIPTION_MAX),
          },
        ],
      });
    }

    return findings;
  },
};

export const accessibilityAdvisor: AdvisorModule = {
  id: "accessibility",
  label: "Accessibility Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const { backgroundColor, accentColor, primaryColor } = ctx.project;
    const fg = "#ffffff";
    const accentOk = meetsWcagAa(fg, accentColor || primaryColor);
    const ratio = contrastRatio(fg, accentColor || primaryColor) ?? 0;

    if (!accentOk) {
      findings.push({
        id: "a11y.cta-contrast",
        category: "accessibility",
        title: "Improve button contrast",
        why: "Low-contrast CTAs are harder to see and can fail accessibility guidelines.",
        impact: "high",
        impactScore: 89,
        confidence: Math.min(0.95, 0.7 + (4.5 - Math.min(ratio, 4.5)) * 0.05),
        operations: [
          {
            operation: "changeTheme",
            accent: "#0f766e",
            primary: primaryColor || "#0f766e",
            background: backgroundColor || "#f7f8fa",
            theme: "light",
          },
        ],
      });
    }

    return findings;
  },
};

export const readabilityAdvisor: AdvisorModule = {
  id: "readability",
  label: "Readability Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    if (ctx.project.siteWidth === "full" && ctx.project.heroSubheadline.length > 180) {
      findings.push({
        id: "readability.dense-hero",
        category: "readability",
        title: "Give the hero more breathing room",
        why: "Long copy on a full-width layout can feel crowded and harder to scan.",
        impact: "medium",
        impactScore: 66,
        confidence: 0.78,
        operations: [
          { operation: "setSiteWidth", value: "boxed" },
          {
            operation: "replaceText",
            target: "hero.subheadline",
            value: `${ctx.project.heroSubheadline.slice(0, 140).trimEnd()}…`,
          },
        ],
      });
    }

    const longNav = ctx.project.pages.some((p) => p.title.length > 14);
    if (longNav) {
      findings.push({
        id: "readability.long-nav",
        category: "readability",
        title: "Shorten navigation labels",
        why: "Shorter labels scan faster on both desktop and mobile.",
        impact: "low",
        impactScore: 48,
        confidence: 0.8,
        operations: [{ operation: "shortenNavigation", maxLabelLength: 10 }],
      });
    }

    return findings;
  },
};

export const mobileAdvisor: AdvisorModule = {
  id: "mobile",
  label: "Mobile Usability Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    if (ctx.project.buttonStyle === "square" && ctx.project.siteWidth === "full") {
      findings.push({
        id: "mobile.tap-targets",
        category: "mobile_usability",
        title: "Use friendlier mobile button shapes",
        why: "Rounded buttons feel easier to tap and scan on smaller screens.",
        impact: "medium",
        impactScore: 64,
        confidence: 0.76,
        operations: [{ operation: "setButtonStyle", value: "rounded" }],
      });
    }
    return findings;
  },
};

export const hierarchyAdvisor: AdvisorModule = {
  id: "hierarchy",
  label: "Visual Hierarchy Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    if (
      ctx.project.headingFont === ctx.project.bodyFont &&
      ctx.project.headingFont === "inter"
    ) {
      findings.push({
        id: "hierarchy.flat-type",
        category: "visual_hierarchy",
        title: "Differentiate heading and body fonts",
        why: "A clearer type hierarchy makes the page easier to scan and feel more intentional.",
        impact: "medium",
        impactScore: 62,
        confidence: 0.77,
        operations: [
          {
            operation: "setTypography",
            headingFont: "manrope",
            bodyFont: "inter",
          },
        ],
      });
    }
    return findings;
  },
};

export const brandingAdvisor: AdvisorModule = {
  id: "branding",
  label: "Branding Advisor",
  review(ctx) {
    const findings: AdvisorFinding[] = [];
    const { primaryColor, accentColor } = ctx.project;
    if (
      primaryColor &&
      accentColor &&
      primaryColor.toLowerCase() === accentColor.toLowerCase()
    ) {
      findings.push({
        id: "branding.same-accent",
        category: "branding_consistency",
        title: "Separate accent color from primary",
        why: "Distinct accents make buttons and highlights stand out from the brand base.",
        impact: "medium",
        impactScore: 71,
        confidence: 0.83,
        operations: [
          {
            operation: "changeTheme",
            primary: primaryColor,
            accent: "#d4af37",
          },
        ],
      });
    }
    return findings;
  },
};

/** Default module set for the Business Advisor pipeline. */
export const DEFAULT_ADVISOR_MODULES: AdvisorModule[] = [
  conversionAdvisor,
  ctaAdvisor,
  trustAdvisor,
  sectionsAdvisor,
  seoAdvisor,
  accessibilityAdvisor,
  readabilityAdvisor,
  mobileAdvisor,
  hierarchyAdvisor,
  brandingAdvisor,
];
