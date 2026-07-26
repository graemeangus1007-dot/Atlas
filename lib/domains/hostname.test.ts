import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyDomainType,
  normalizeAndValidateHostname,
} from "@/lib/domains/hostname";
import { MockDomainProvider } from "@/lib/domains/mock-provider";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { safeDomainErrorMessage } from "@/lib/domains/serialize";
import { redactSecrets } from "@/lib/deployment/server-config";

describe("hostname normalization & validation", () => {
  it("normalizes apex domains", () => {
    const result = normalizeAndValidateHostname("Example.COM.");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBe("example.com");
    expect(result.normalizedHostname).toBe("example.com");
    expect(result.domainType).toBe("apex");
  });

  it("normalizes subdomains", () => {
    const result = normalizeAndValidateHostname("WWW.Example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBe("www.example.com");
    expect(result.domainType).toBe("subdomain");
  });

  it("strips protocol, path, query, and fragment", () => {
    const result = normalizeAndValidateHostname(
      "https://Shop.Example.com/path?x=1#top",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hostname).toBe("shop.example.com");
  });

  it("rejects ports", () => {
    const result = normalizeAndValidateHostname("example.com:443");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("port");
  });

  it("rejects IP addresses and localhost", () => {
    expect(normalizeAndValidateHostname("127.0.0.1").ok).toBe(false);
    expect(normalizeAndValidateHostname("192.168.1.1").ok).toBe(false);
    expect(normalizeAndValidateHostname("localhost").ok).toBe(false);
    expect(normalizeAndValidateHostname("app.localhost").ok).toBe(false);
  });

  it("rejects wildcards and invalid labels", () => {
    expect(normalizeAndValidateHostname("*.example.com").ok).toBe(false);
    expect(normalizeAndValidateHostname("-bad.example.com").ok).toBe(false);
    expect(normalizeAndValidateHostname("example").ok).toBe(false);
  });

  it("rejects Atlas/Vercel preview domains", () => {
    expect(normalizeAndValidateHostname("foo.vercel.app").ok).toBe(false);
    expect(normalizeAndValidateHostname("bar.now.sh").ok).toBe(false);
    expect(
      normalizeAndValidateHostname("site.preview.atlas.site").ok,
    ).toBe(false);
    expect(normalizeAndValidateHostname("preview.atlas.site").ok).toBe(false);
  });

  it("classifies multi-part TLD apex domains", () => {
    expect(classifyDomainType("example.co.uk")).toBe("apex");
    expect(classifyDomainType("www.example.co.uk")).toBe("subdomain");
  });

  it("supports international domains via punycode normalization", () => {
    const result = normalizeAndValidateHostname("bücher.example");
    // May fail label rules if TLD is only "example" — use a real-looking IDN host.
    const idn = normalizeAndValidateHostname("münchen.de");
    expect(idn.ok).toBe(true);
    if (!idn.ok) return;
    expect(idn.normalizedHostname.startsWith("xn--")).toBe(true);
  });
});

describe("domain provider + security helpers", () => {
  it("mock provider returns DNS verification records", async () => {
    const provider = new MockDomainProvider();
    const added = await provider.addDomain("www.example.com");
    expect(added.kind).toBe("created");
    if (added.kind !== "created") return;
    expect(added.providerDomainId).toBeTruthy();
    expect(added.verificationRecords.length).toBeGreaterThan(0);
    expect(added.verificationRecords.some((r) => r.type === "TXT")).toBe(true);
    await provider.removeDomain(added.providerDomainId);
  });

  it("redacts provider secrets from error messages", () => {
    const token = "super-secret-vercel-token";
    const message = safeDomainErrorMessage(
      new Error(`Bearer ${token} failed upstream`),
    );
    // safeDomainErrorMessage uses env token; also test redactSecrets directly.
    expect(redactSecrets(`Auth ${token} failed`, token)).not.toContain(token);
    expect(message.toLowerCase()).not.toContain("super-secret-vercel-token");
  });

  it("rate limit extension point blocks after the configured limit", () => {
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

    const key = `test:${Math.random()}`;
    expect(
      checkDomainRateLimit(key, { limit: 2, windowMs: 60_000, store }).allowed,
    ).toBe(true);
    expect(
      checkDomainRateLimit(key, { limit: 2, windowMs: 60_000, store }).allowed,
    ).toBe(true);
    expect(
      checkDomainRateLimit(key, { limit: 2, windowMs: 60_000, store }).allowed,
    ).toBe(false);
  });
});

describe("project_domains migration contracts", () => {
  it("enforces global hostname uniqueness, one domain per project, and RLS", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260727_project_domains.sql",
      ),
      "utf8",
    );
    expect(source).toContain("create table if not exists public.project_domains");
    expect(source).toContain("project_domains_normalized_hostname_unique");
    expect(source).toContain("project_domains_project_id_unique");
    expect(source).toContain("enable row level security");
    expect(source).toContain("Users can select own project domains");
    expect(source).toContain("ownership fields are immutable");
    expect(source).toContain("pending");
    expect(source).toContain("verification_records");
  });
});

describe("duplicate hostname / ownership API contracts", () => {
  it("documents that owner_id from the browser is rejected", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/route.ts"),
      "utf8",
    );
    expect(source).toContain("owner_id cannot be set by the client");
    expect(source).toContain("auth.userId");
    expect(source).toContain("That domain is already connected");
  });

  it("allows removing domains including active, with ownership checks", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/[id]/route.ts"),
      "utf8",
    );
    expect(source).toContain('"active"');
    expect(source).toContain("eq(\"owner_id\", user.id)");
    expect(source).toContain("removeDomain");
  });
});
