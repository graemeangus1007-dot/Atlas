import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDeploymentProvider,
  getDeploymentProviderId,
  resolveDeploymentProvider,
} from "@/lib/deployment/create-provider";
import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";

describe("client create-provider (browser-safe)", () => {
  it("parses overrides including vercel", () => {
    expect(getDeploymentProviderId("supabase")).toBe("supabase");
    expect(getDeploymentProviderId("supabase-preview")).toBe("supabase");
    expect(getDeploymentProviderId("vercel")).toBe("vercel");
    expect(getDeploymentProviderId("mock")).toBe("mock");
  });

  it("defaults to mock without override (no client env selection)", () => {
    expect(getDeploymentProviderId()).toBe("mock");
    expect(getDeploymentProviderId("")).toBe("mock");
  });

  it("only constructs the mock provider in the client factory", () => {
    expect(createDeploymentProvider("supabase")).toBeInstanceOf(
      MockDeploymentProvider,
    );
    expect(createDeploymentProvider("vercel")).toBeInstanceOf(
      MockDeploymentProvider,
    );
    expect(createDeploymentProvider("mock")).toBeInstanceOf(
      MockDeploymentProvider,
    );
    expect(resolveDeploymentProvider()).toBeInstanceOf(MockDeploymentProvider);
  });

  it("never references Vercel secrets or server-only modules", () => {
    const sourcePath = resolve(__dirname, "create-provider.ts");
    const source = readFileSync(sourcePath, "utf8");
    expect(source).not.toContain("VERCEL_TOKEN");
    expect(source).not.toContain("VERCEL_PROJECT_ID");
    expect(source).not.toContain("vercel-provider");
    expect(source).not.toContain("server-config");
    expect(source).not.toContain("NEXT_PUBLIC_DEPLOYMENT_PROVIDER");
  });
});
