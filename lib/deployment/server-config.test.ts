import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDeploymentProviderLabel,
  getDeploymentProviderRecordId,
  getServerDeploymentProviderId,
  getVercelDeploymentConfig,
  redactSecrets,
} from "@/lib/deployment/server-config";

describe("server deployment config", () => {
  it("reads DEPLOYMENT_PROVIDER overrides", () => {
    expect(getServerDeploymentProviderId("vercel")).toBe("vercel");
    expect(getServerDeploymentProviderId("supabase")).toBe("supabase");
    expect(getServerDeploymentProviderId("supabase-preview")).toBe("supabase");
    expect(getServerDeploymentProviderId("mock")).toBe("mock");
    expect(getServerDeploymentProviderId("")).toBe("mock");
  });

  it("maps labels and record ids", () => {
    expect(getDeploymentProviderRecordId("vercel")).toBe("vercel");
    expect(getDeploymentProviderRecordId("supabase")).toBe("supabase-preview");
    expect(getDeploymentProviderRecordId("mock")).toBe("mock-local");
    expect(getDeploymentProviderLabel("vercel")).toContain("Vercel");
  });

  it("requires token + project id for Vercel config", () => {
    const prevToken = process.env.VERCEL_TOKEN;
    const prevProject = process.env.VERCEL_PROJECT_ID;
    const prevTeam = process.env.VERCEL_TEAM_ID;
    try {
      delete process.env.VERCEL_TOKEN;
      delete process.env.VERCEL_PROJECT_ID;
      delete process.env.VERCEL_TEAM_ID;
      expect(() => getVercelDeploymentConfig()).toThrow(/VERCEL_TOKEN/);

      process.env.VERCEL_TOKEN = "test-token-secret-value";
      expect(() => getVercelDeploymentConfig()).toThrow(/VERCEL_PROJECT_ID/);

      process.env.VERCEL_PROJECT_ID = "prj_test";
      expect(getVercelDeploymentConfig()).toEqual({
        token: "test-token-secret-value",
        projectId: "prj_test",
        teamId: undefined,
      });

      process.env.VERCEL_TEAM_ID = "team_123";
      expect(getVercelDeploymentConfig().teamId).toBe("team_123");
    } finally {
      if (prevToken === undefined) delete process.env.VERCEL_TOKEN;
      else process.env.VERCEL_TOKEN = prevToken;
      if (prevProject === undefined) delete process.env.VERCEL_PROJECT_ID;
      else process.env.VERCEL_PROJECT_ID = prevProject;
      if (prevTeam === undefined) delete process.env.VERCEL_TEAM_ID;
      else process.env.VERCEL_TEAM_ID = prevTeam;
    }
  });

  it("redacts tokens from error messages", () => {
    const token = "super-secret-token-xyz";
    expect(redactSecrets(`Bearer ${token} failed`, token)).not.toContain(token);
    expect(redactSecrets(`Bearer ${token} failed`, token)).toContain(
      "[redacted]",
    );
  });

  it("server-config source is not a NEXT_PUBLIC secret surface", () => {
    const source = readFileSync(
      resolve(__dirname, "server-config.ts"),
      "utf8",
    );
    expect(source).toContain("DEPLOYMENT_PROVIDER");
    expect(source).toContain("VERCEL_TOKEN");
    // Must not advertise the token as a public env var.
    expect(source).not.toContain("NEXT_PUBLIC_VERCEL_TOKEN");
  });
});
