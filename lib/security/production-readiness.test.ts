import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SECRET_ENV_KEYS } from "@/lib/env/types";
import { PROTECTED_PREFIXES } from "@/lib/auth/middleware";
import { redactSecrets, redactSecretsDeep } from "@/lib/monitoring/redact";

const ROOT = join(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === ".git" ||
      name === "coverage"
    ) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name) && !name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const SERVER_ONLY_IMPORTS = [
  "@/lib/env/server",
  "@/lib/supabase/service",
  "@/lib/deployment/server-config",
];

describe("client bundle secret contracts", () => {
  it("never prefixes secrets with NEXT_PUBLIC_", () => {
    for (const key of SECRET_ENV_KEYS) {
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });

  it("does not import server-only modules from client components", () => {
    const files = walk(ROOT).filter((file) => {
      const src = readFileSync(file, "utf8");
      return (
        /^\s*["']use client["']/m.test(src) ||
        /[\\/]components[\\/]/.test(file)
      );
    });

    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(src)) continue;
      for (const mod of SERVER_ONLY_IMPORTS) {
        const importRe = new RegExp(
          `from\\s+["']${mod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
        );
        if (importRe.test(src)) {
          violations.push(`${relative(ROOT, file)} imports ${mod}`);
        }
      }
      if (
        /process\.env\.(SUPABASE_SERVICE_ROLE_KEY|VERCEL_TOKEN|RESEND_API_KEY)/.test(
          src,
        )
      ) {
        violations.push(
          `${relative(ROOT, file)} reads a server secret via process.env`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not expose Vercel or Resend tokens via NEXT_PUBLIC_ env names in app source", () => {
    const files = walk(ROOT).filter(
      (file) =>
        /[\\/](app|components|lib|hooks|context)[\\/]/.test(file) &&
        !file.includes(".test."),
    );
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Ignore documentation strings that forbid the pattern.
      if (
        /NEXT_PUBLIC_(VERCEL_TOKEN|RESEND_API_KEY|SUPABASE_SERVICE_ROLE)/.test(
          src,
        ) &&
        !/Never put|never put|must never|do not/.test(src)
      ) {
        hits.push(relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("public API data isolation contracts", () => {
  it("analytics collect never selects private lead rows", () => {
    const src = readFileSync(
      join(ROOT, "app/api/analytics/collect/route.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/lead_submissions/);
    expect(src).not.toMatch(/\.from\(\s*["']leads["']/);
  });

  it("public form submit does not return submission lists or owner notify address", () => {
    const src = readFileSync(
      join(ROOT, "app/api/forms/[formId]/submit/route.ts"),
      "utf8",
    );
    expect(src).toContain(
      'select("id, project_id, owner_id, is_enabled, success_message")',
    );
    expect(src).not.toMatch(/\.select\([^)]*notification_email/);
    expect(src).not.toMatch(/leads:\s/);
    expect(src).toMatch(/Never returns submission lists/i);
  });

  it("owner APIs require ownership checks (cross-project blocked)", () => {
    const leads = readFileSync(join(ROOT, "app/api/leads/route.ts"), "utf8");
    expect(leads).toMatch(/eq\(\s*["']owner_id["']/);
    expect(leads).toMatch(/eq\(\s*["']project_id["']/);

    const leadDetail = readFileSync(
      join(ROOT, "app/api/leads/[id]/route.ts"),
      "utf8",
    );
    expect(leadDetail).toMatch(/eq\(\s*["']owner_id["']/);
    expect(leadDetail).toContain('ownerHasFeature(user.id, "leadInbox"');

    const domains = readFileSync(join(ROOT, "app/api/domains/route.ts"), "utf8");
    expect(domains).toMatch(/requireOwnedProject/);
    expect(domains).toMatch(/eq\(\s*["']owner_id["']/);

    const analyticsAuth = readFileSync(
      join(ROOT, "lib/analytics/auth.ts"),
      "utf8",
    );
    expect(analyticsAuth).toMatch(/owner_id/);
    expect(analyticsAuth).toContain("requireBasicAnalytics");
  });

  it("does not ship temporary billing debug routes", () => {
    const route = join(ROOT, "app/api/debug/billing-env/route.ts");
    expect(() => readFileSync(route, "utf8")).toThrow();
  });

  it("protects leads and profile behind auth middleware", () => {
    expect(PROTECTED_PREFIXES).toEqual(
      expect.arrayContaining(["/leads", "/profile", "/dashboard"]),
    );
  });
});

describe("monitoring redaction", () => {
  it("redacts bearer tokens and JWT-like strings", () => {
    const raw =
      "Authorization: Bearer vcp_secrettoken123 and eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa.bbbb";
    const out = redactSecrets(raw);
    expect(out).not.toContain("vcp_secrettoken123");
    expect(out).toContain("[redacted]");
  });

  it("redacts lead message fields in context objects", () => {
    const out = redactSecretsDeep({
      leadMessage: "Please call me about pricing",
      message: "secret body",
      projectId: "abc",
    });
    expect(out.leadMessage).toBe("[redacted]");
    expect(out.message).toBe("[redacted]");
    expect(out.projectId).toBe("abc");
  });
});
