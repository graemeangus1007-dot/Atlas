import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashIp } from "@/lib/leads/ip";
import {
  escapeHtml,
  isValidEmail,
  normalizeEmail,
  sanitizePlainText,
  stripHtmlTags,
} from "@/lib/leads/sanitize";
import {
  checkLeadSubmitRateLimit,
  LEAD_SUBMIT_MAX_BODY_BYTES,
  validateLeadSubmission,
} from "@/lib/leads/validate";
import { generateWebsiteContent } from "@/lib/website-generator";
import { defaultProjectContact } from "@/lib/contact";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    businessName: "Northforge",
    businessType: "Other",
    description: "A sample business",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact us",
    services: [],
    contact: {
      ...defaultProjectContact("Northforge"),
      formId: "form_abc123",
      formEnabled: true,
      buttonText: "Send message",
      successMessage: "Thanks!",
      showPhoneField: true,
      showCompanyField: true,
    },
    templateId: "modern",
    pages: [],
    primaryColor: "#111111",
    secondaryColor: "#222222",
    accentColor: "#3db8a8",
    backgroundColor: "#0b0f14",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    heroOverlay: 40,
    siteWidth: "wide",
    theme: "dark",
    logo: null,
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: [],
    status: "ready",
    publish: null,
    ...overrides,
  };
}

describe("lead submission validation", () => {
  it("accepts a valid submission", () => {
    const result = validateLeadSubmission({
      name: " Ada Lovelace ",
      email: "Ada@Example.COM",
      phone: "555-0100",
      company: "Analytical Engines",
      message: "Hello there",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Ada Lovelace");
    expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects invalid email", () => {
    const result = validateLeadSubmission({
      name: "Ada",
      email: "not-an-email",
      message: "Hi",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields?.email).toMatch(/valid email/i);
  });

  it("documents oversized payload limit", () => {
    expect(LEAD_SUBMIT_MAX_BODY_BYTES).toBe(16_384);
    const source = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/submit/route.ts"),
      "utf8",
    );
    expect(source).toContain("LEAD_SUBMIT_MAX_BODY_BYTES");
    expect(source).toContain("413");
  });

  it("rate limits repeated submit keys", () => {
    const store = {
      state: new Map<string, { count: number; resetAt: number }>(),
      hit(key: string, windowMs: number) {
        const now = Date.now();
        const existing = this.state.get(key);
        if (!existing || existing.resetAt <= now) {
          const next = { count: 1, resetAt: now + windowMs };
          this.state.set(key, next);
          return next;
        }
        existing.count += 1;
        return existing;
      },
    };
    const key = `leads:test:${Math.random()}`;
    for (let i = 0; i < 8; i += 1) {
      expect(checkLeadSubmitRateLimit(key, { store }).allowed).toBe(true);
    }
    expect(checkLeadSubmitRateLimit(key, { store }).allowed).toBe(false);
  });

  it("sanitizes XSS / HTML from inputs", () => {
    expect(stripHtmlTags('<script>alert(1)</script>Hi')).toBe("alert(1)Hi");
    const cleaned = sanitizePlainText(
      '  <img src=x onerror=alert(1)>Hello\u0000  ',
      { maxLength: 100 },
    );
    expect(cleaned).toBe("Hello");
    expect(cleaned).not.toContain("<");
    expect(escapeHtml('<b>"x"</b>')).toBe("&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
    expect(normalizeEmail("  A@B.Com ")).toBe("a@b.com");
    expect(isValidEmail("a@b.com")).toBe(true);
  });
});

describe("IP hashing", () => {
  it("hashes IPs and never returns the raw value", () => {
    const hashed = hashIp("203.0.113.10");
    expect(hashed).toBeTruthy();
    expect(hashed).not.toContain("203.0.113.10");
    expect(hashIp("203.0.113.10")).toBe(hashed);
    expect(hashIp(null)).toBeNull();
  });
});

describe("dashboard + API contracts", () => {
  it("leads routes enforce owner checks and status updates", () => {
    const list = readFileSync(
      resolve(__dirname, "../../app/api/leads/route.ts"),
      "utf8",
    );
    const patch = readFileSync(
      resolve(__dirname, "../../app/api/leads/[id]/route.ts"),
      "utf8",
    );
    expect(list).toContain('eq("owner_id", user.id)');
    expect(list).toContain("Unauthorized");
    expect(patch).toContain('"read"');
    expect(patch).toContain('"archived"');
    expect(patch).toContain('eq("owner_id", user.id)');
  });

  it("UI supports mark read and archive", () => {
    const source = readFileSync(
      resolve(__dirname, "../../components/leads/leads-page.tsx"),
      "utf8",
    );
    expect(source).toContain("Mark read");
    expect(source).toContain("Archive");
    expect(source).toContain("/api/leads");
  });

  it("submit route redacts errors and sets CORS", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/submit/route.ts"),
      "utf8",
    );
    expect(source).toContain("Access-Control-Allow-Origin");
    expect(source).toContain("safeLeadErrorMessage");
    expect(source).toContain("Could not send your message");
    expect(source).not.toContain("insertError.message");
    // Anon cannot RETURNING/select submissions — use explicit id insert.
    expect(source).not.toContain(".insert(row).select");
    expect(source).toContain(".insert(row)");
  });
});

describe("published site form wiring", () => {
  it("embeds submit endpoint when formId is present", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://atlas.example.com";
    try {
      const content = generateWebsiteContent(sampleProject());
      expect(content.contact.form.formId).toBe("form_abc123");
      expect(content.contact.form.apiBaseUrl).toBe("https://atlas.example.com");

      const artifact = buildStaticSite(sampleProject());
      const html = artifact.files.find((f) => f.path === "index.html")?.content;
      expect(html).toBeTruthy();
      expect(html).toContain(
        "https://atlas.example.com/api/forms/form_abc123/submit",
      );
      expect(html).toContain("data-atlas-contact-form");
      expect(html).toContain("site-form-honeypot");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});

describe("migration contracts", () => {
  it("defines lead_forms and lead_submissions with RLS", () => {
    const source = readFileSync(
      resolve(__dirname, "../../supabase/migrations/20260730_lead_forms.sql"),
      "utf8",
    );
    expect(source).toContain("create table if not exists public.lead_forms");
    expect(source).toContain("create table if not exists public.lead_submissions");
    expect(source).toContain("enable row level security");
    expect(source).toContain("Public can insert submissions to enabled forms");
    expect(source).toContain("Owners can select own lead submissions");
    expect(source).toContain("ip_hash");
    expect(source).not.toContain("raw_ip");
  });
});
