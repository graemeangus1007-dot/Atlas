import { describe, expect, it } from "vitest";
import { redactSecrets, redactSecretsDeep } from "@/lib/monitoring/redact";

describe("redactSecrets", () => {
  it("removes provided extra secrets", () => {
    const secret = "super-secret-value-999";
    expect(redactSecrets(`token=${secret}`, [secret])).toBe(
      "token=[redacted]",
    );
  });
});

describe("redactSecretsDeep", () => {
  it("does not mutate nested non-sensitive values", () => {
    const input = { tags: { route: "leads.list" }, count: 2 };
    expect(redactSecretsDeep(input)).toEqual(input);
  });
});
