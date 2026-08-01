/**
 * Single New Site creation path — no competing create funnels.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NEW_SITE_HREF, NEW_SITE_LABEL } from "@/lib/product/new-site";
import { PROTECTED_PREFIXES } from "@/lib/auth/middleware";

describe("New Site creation path", () => {
  it("uses /onboarding as the only create href", () => {
    expect(NEW_SITE_HREF).toBe("/onboarding");
    expect(NEW_SITE_LABEL).toBe("New Site");
  });

  it("requires auth for onboarding so guests resume into the same flow", () => {
    expect(PROTECTED_PREFIXES).toContain("/onboarding");
  });

  it("hero, CTA, and project list all target NEW_SITE_HREF", () => {
    const hero = readFileSync(
      resolve(__dirname, "../../components/hero.tsx"),
      "utf8",
    );
    const cta = readFileSync(
      resolve(__dirname, "../../components/cta.tsx"),
      "utf8",
    );
    const list = readFileSync(
      resolve(__dirname, "../../components/dashboard/project-list.tsx"),
      "utf8",
    );
    const navbar = readFileSync(
      resolve(__dirname, "../../components/navbar.tsx"),
      "utf8",
    );

    for (const src of [hero, cta, list, navbar]) {
      expect(src).toContain("NEW_SITE_HREF");
      expect(src).toContain("NEW_SITE_LABEL");
    }

    expect(list).toContain("router.push(NEW_SITE_HREF)");
    expect(list).not.toMatch(/createProject\(/);
  });

  it("legacy AI Website and generating routes redirect to onboarding", () => {
    const ai = readFileSync(
      resolve(__dirname, "../../app/dashboard/ai/page.tsx"),
      "utf8",
    );
    const generating = readFileSync(
      resolve(__dirname, "../../app/generating/page.tsx"),
      "utf8",
    );
    expect(ai).toContain('redirect("/onboarding")');
    expect(generating).toContain('redirect("/onboarding")');
  });

  it("signup defaults into onboarding, not dashboard", () => {
    const signup = readFileSync(
      resolve(__dirname, "../../components/auth/signup-form.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      resolve(__dirname, "../../lib/auth/actions.ts"),
      "utf8",
    );
    expect(signup).toContain("NEW_SITE_AFTER_SIGNUP_HREF");
    expect(signup).not.toContain('replace("/dashboard")');
    expect(actions).toContain("NEW_SITE_AFTER_SIGNUP_HREF");
  });
});
