import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLeadNotificationEmail,
  buildSecureLeadUrl,
} from "@/lib/email/lead-notification-template";
import { deliverLeadNotification } from "@/lib/email/deliver-lead-notification";
import { redactProviderError } from "@/lib/email/errors";
import { MockEmailProvider } from "@/lib/email/mock-provider";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  filterLeadsForInbox,
  countUnread,
} from "@/lib/leads/inbox";
import { isValidEmail, normalizeEmail } from "@/lib/leads/sanitize";
import type { PublicLeadSubmission } from "@/lib/leads/types";

function sampleLead(
  overrides: Partial<PublicLeadSubmission> = {},
): PublicLeadSubmission {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    formId: "form1",
    projectId: "proj1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "555-0100",
    company: "Analytical Engines",
    message: "Hello there",
    metadata: {},
    status: "new",
    isStarred: false,
    internalNotes: "",
    notificationStatus: "pending",
    notificationAttemptedAt: null,
    notificationSentAt: null,
    notificationError: null,
    createdAt: "2026-07-26T12:00:00.000Z",
    ...overrides,
  };
}

type FakeRow = {
  id: string;
  form_id: string;
  project_id: string;
  owner_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  metadata: Record<string, unknown>;
  ip_hash: string | null;
  user_agent: string | null;
  status: string;
  is_starred: boolean;
  internal_notes: string;
  notification_status: string;
  notification_attempted_at: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  notification_provider_message_id: string | null;
  created_at: string;
};

function createFakeSupabase(opts: {
  submission: FakeRow;
  form: Record<string, unknown>;
  project?: { id: string; name: string; business_name: string };
}) {
  const state = {
    submission: { ...opts.submission },
    form: { ...opts.form },
    project: opts.project ?? {
      id: opts.submission.project_id,
      name: "Northforge",
      business_name: "Northforge",
    },
  };

  const from = (table: string) => {
    const selectChain = {
      select: (_cols?: string) => selectChain,
      eq: (_col: string, _val: unknown) => selectChain,
      maybeSingle: async () => {
        if (table === "lead_submissions") {
          return { data: { ...state.submission }, error: null };
        }
        if (table === "lead_forms") {
          return { data: { ...state.form }, error: null };
        }
        if (table === "projects") {
          return { data: { ...state.project }, error: null };
        }
        return { data: null, error: null };
      },
    };

    return {
      ...selectChain,
      update: (patch: Record<string, unknown>) => {
        let statusFilter: string | null = null;

        const apply = () => {
          if (table === "lead_forms") {
            Object.assign(state.form, patch);
            return {
              data: { id: state.form.id },
              error: null,
            };
          }
          if (table === "lead_submissions") {
            if (
              statusFilter === "pending" &&
              state.submission.notification_status !== "pending"
            ) {
              return { data: null, error: null };
            }
            Object.assign(state.submission, patch);
            return {
              data: {
                id: state.submission.id,
                notification_status: state.submission.notification_status,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        };

        const chain: {
          eq: (col: string, val: unknown) => typeof chain;
          select: () => typeof chain;
          maybeSingle: () => Promise<ReturnType<typeof apply>>;
          then: Promise<ReturnType<typeof apply>>["then"];
        } = {
          eq: (col: string, val: unknown) => {
            if (col === "notification_status") statusFilter = String(val);
            return chain;
          },
          select: () => chain,
          maybeSingle: async () => apply(),
          then: (onFulfilled, onRejected) =>
            Promise.resolve(apply()).then(onFulfilled, onRejected),
        };
        return chain;
      },
    };
  };

  return {
    client: { from } as never,
    state,
  };
}

describe("email HTML escaping", () => {
  it("escapes lead content in HTML emails", () => {
    const { html, text, subject } = buildLeadNotificationEmail({
      leadName: `<script>alert(1)</script>`,
      leadEmail: `evil@example.com`,
      leadPhone: null,
      leadCompany: `Acme & Co`,
      leadMessage: `Hello <b>there</b>\nLine 2`,
      projectName: `Northforge`,
      submittedAt: `Sun, 26 Jul 2026 12:00:00 GMT`,
      leadUrl: `https://atlas.example.com/leads?lead=11111111-1111-1111-1111-111111111111`,
      subjectTemplate: `New lead from {{name}} — {{project}}`,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain("&lt;b&gt;there&lt;/b&gt;");
    expect(html).not.toContain("ip_hash");
    expect(text).toContain("<script>alert(1)</script>"); // plain text keeps raw but no HTML render
    expect(subject).toContain("New lead from");
  });

  it("prevents open redirects in lead links", () => {
    const url = buildSecureLeadUrl(
      "https://atlas.example.com",
      "11111111-1111-1111-1111-111111111111",
    );
    expect(url).toBe(
      "https://atlas.example.com/leads?lead=11111111-1111-1111-1111-111111111111",
    );
    expect(() =>
      buildSecureLeadUrl("javascript:alert(1)", "11111111-1111-1111-1111-111111111111"),
    ).toThrow();
    expect(() =>
      buildSecureLeadUrl("https://atlas.example.com", "../evil"),
    ).toThrow();
  });
});

describe("provider error redaction", () => {
  it("redacts API keys and bearer tokens", () => {
    const redacted = redactProviderError(
      "Unauthorized Bearer re_abcdefghijklmnopqrstuvwxyz123456 status",
    );
    expect(redacted).not.toContain("re_abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).toContain("[redacted]");
  });
});

describe("lead notification delivery", () => {
  const baseSubmission: FakeRow = {
    id: "11111111-1111-1111-1111-111111111111",
    form_id: "form1",
    project_id: "proj1",
    owner_id: "owner1",
    name: "Ada",
    email: "ada@example.com",
    phone: "555",
    company: "Engines",
    message: "Hi",
    metadata: {},
    ip_hash: "should-never-appear",
    user_agent: null,
    status: "new",
    is_starred: false,
    internal_notes: "",
    notification_status: "pending",
    notification_attempted_at: null,
    notification_sent_at: null,
    notification_error: null,
    notification_provider_message_id: null,
    created_at: "2026-07-26T12:00:00.000Z",
  };

  it("sends a successful email notification", async () => {
    const provider = new MockEmailProvider();
    const { client, state } = createFakeSupabase({
      submission: { ...baseSubmission },
      form: {
        id: "form1",
        email_notifications_enabled: true,
        notification_email: "owner@example.com",
        email_subject_template: "Lead: {{name}}",
      },
    });

    const result = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
      fromAddress: "Atlas <notify@example.com>",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("sent");
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.to).toBe("owner@example.com");
    expect(provider.sent[0]?.html).not.toContain("should-never-appear");
    expect(state.submission.notification_status).toBe("sent");
    expect(state.submission.notification_provider_message_id).toBeTruthy();
  });

  it("records provider failure without affecting visitor success contract", async () => {
    const provider = new MockEmailProvider({ failNext: true });
    const { client, state } = createFakeSupabase({
      submission: { ...baseSubmission },
      form: {
        id: "form1",
        email_notifications_enabled: true,
        notification_email: "owner@example.com",
        email_subject_template: "Lead: {{name}}",
      },
    });

    const result = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("failed");
    expect(state.submission.notification_status).toBe("failed");
    expect(state.form.last_notification_error).toBeTruthy();

    const submitSource = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/submit/route.ts"),
      "utf8",
    );
    expect(submitSource).toContain("scheduleLeadNotificationDelivery");
    expect(submitSource).toContain("after");
    expect(submitSource).not.toContain("notification failed");
  });

  it("prevents duplicate notification sends", async () => {
    const provider = new MockEmailProvider();
    const { client, state } = createFakeSupabase({
      submission: { ...baseSubmission },
      form: {
        id: "form1",
        email_notifications_enabled: true,
        notification_email: "owner@example.com",
        email_subject_template: "Lead",
      },
    });

    const first = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
    });
    expect(first.ok).toBe(true);
    expect(provider.sent).toHaveLength(1);

    const second = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.duplicate).toBe(true);
    expect(provider.sent).toHaveLength(1);
    expect(state.submission.notification_status).toBe("sent");
  });

  it("skips when notifications are disabled", async () => {
    const provider = new MockEmailProvider();
    const { client, state } = createFakeSupabase({
      submission: { ...baseSubmission },
      form: {
        id: "form1",
        email_notifications_enabled: false,
        notification_email: "owner@example.com",
        email_subject_template: "Lead",
      },
    });

    const result = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("skipped");
    expect(provider.sent).toHaveLength(0);
    expect(state.submission.notification_status).toBe("skipped");
  });

  it("fails closed on invalid notification email", async () => {
    const provider = new MockEmailProvider();
    const { client, state } = createFakeSupabase({
      submission: { ...baseSubmission },
      form: {
        id: "form1",
        email_notifications_enabled: true,
        notification_email: "not-an-email",
        email_subject_template: "Lead",
      },
    });

    const result = await deliverLeadNotification(baseSubmission.id, {
      supabase: client,
      provider,
      atlasOrigin: "https://atlas.example.com",
    });

    expect(result.ok).toBe(false);
    expect(state.submission.notification_status).toBe("failed");
    expect(provider.sent).toHaveLength(0);
  });
});

describe("test notification rate limiting", () => {
  it("rate limits test notification keys", () => {
    const store = {
      hit: vi.fn((key: string, windowMs: number) => {
        const count = (store as { n?: number }).n ?? 0;
        (store as { n?: number }).n = count + 1;
        return { count: count + 1, resetAt: Date.now() + windowMs };
      }),
    };
    for (let i = 0; i < 5; i++) {
      expect(
        checkDomainRateLimit("forms:test-notify:user1", {
          limit: 5,
          windowMs: 15 * 60_000,
          store,
        }).allowed,
      ).toBe(true);
    }
    expect(
      checkDomainRateLimit("forms:test-notify:user1", {
        limit: 5,
        windowMs: 15 * 60_000,
        store,
      }).allowed,
    ).toBe(false);

    const source = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/test-notification/route.ts"),
      "utf8",
    );
    expect(source).toContain("forms:test-notify:");
    expect(source).toContain("limit: 5");
  });
});

describe("lead inbox helpers", () => {
  const leads = [
    sampleLead({
      id: "a",
      status: "new",
      name: "Ada",
      email: "ada@example.com",
      createdAt: "2026-07-26T12:00:00.000Z",
    }),
    sampleLead({
      id: "b",
      status: "read",
      name: "Grace",
      email: "grace@example.com",
      company: "Navy",
      isStarred: true,
      createdAt: "2026-07-25T12:00:00.000Z",
    }),
    sampleLead({
      id: "c",
      status: "archived",
      name: "Alan",
      email: "alan@example.com",
      message: "Enigma",
      createdAt: "2026-07-24T12:00:00.000Z",
    }),
    sampleLead({
      id: "d",
      status: "spam",
      name: "Bot",
      email: "bot@spam.test",
      createdAt: "2026-07-23T12:00:00.000Z",
    }),
  ];

  it("counts unread", () => {
    expect(countUnread(leads)).toBe(1);
  });

  it("searches name, email, company, phone, message", () => {
    expect(filterLeadsForInbox(leads, { q: "grace" }).items.map((l) => l.id)).toEqual([
      "b",
    ]);
    expect(filterLeadsForInbox(leads, { q: "enigma" }).items.map((l) => l.id)).toEqual([
      "c",
    ]);
    expect(filterLeadsForInbox(leads, { q: "navy" }).items.map((l) => l.id)).toEqual([
      "b",
    ]);
  });

  it("filters new/read/archived/spam/starred and sorts newest first", () => {
    expect(filterLeadsForInbox(leads, { status: "new" }).items.map((l) => l.id)).toEqual([
      "a",
    ]);
    expect(
      filterLeadsForInbox(leads, { status: "archived" }).items.map((l) => l.id),
    ).toEqual(["c"]);
    expect(filterLeadsForInbox(leads, { status: "spam" }).items.map((l) => l.id)).toEqual([
      "d",
    ]);
    expect(
      filterLeadsForInbox(leads, { status: "starred" }).items.map((l) => l.id),
    ).toEqual(["b"]);
    expect(filterLeadsForInbox(leads, { status: "all" }).items.map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("paginates", () => {
    const page1 = filterLeadsForInbox(leads, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(4);
    const page2 = filterLeadsForInbox(leads, { page: 2, pageSize: 2 });
    expect(page2.items.map((l) => l.id)).toEqual(["c", "d"]);
  });
});

describe("notification email validation", () => {
  it("validates notification email addresses", () => {
    expect(isValidEmail(normalizeEmail(" Owner@Example.COM "))).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("authorization + inbox API contracts", () => {
  it("documents owner-scoped lead updates and inbox actions", () => {
    const patch = readFileSync(
      resolve(__dirname, "../../app/api/leads/[id]/route.ts"),
      "utf8",
    );
    expect(patch).toContain('eq("owner_id", user.id)');
    expect(patch).toContain("isStarred");
    expect(patch).toContain("internalNotes");
    expect(patch).toContain("sanitizePlainText");
    expect(patch).toContain('"new"');
    expect(patch).toContain('"spam"');

    const list = readFileSync(
      resolve(__dirname, "../../app/api/leads/route.ts"),
      "utf8",
    );
    expect(list).toContain("Unauthorized");
    expect(list).toContain("unreadCount");
    expect(list).toContain("filterLeadsForInbox");

    const ui = readFileSync(
      resolve(__dirname, "../../components/leads/leads-page.tsx"),
      "utf8",
    );
    expect(ui).toContain("Mark unread");
    expect(ui).toContain("Unarchive");
    expect(ui).toContain("Not spam");
    expect(ui).toContain("isStarred");
    expect(ui).toContain("internalNotes");
    expect(ui).toContain("mailto:");
  });

  it("documents form notification settings + test endpoint", () => {
    const formRoute = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/route.ts"),
      "utf8",
    );
    expect(formRoute).toContain("notification_email");
    expect(formRoute).toContain("isValidEmail");

    const ensure = readFileSync(
      resolve(__dirname, "../../app/api/forms/ensure/route.ts"),
      "utf8",
    );
    expect(ensure).toContain("notification_email");
    expect(ensure).toContain("user.email");

    const editor = readFileSync(
      resolve(__dirname, "../../components/editor/contact-form-notifications.tsx"),
      "utf8",
    );
    expect(editor).toContain("Enable email notifications");
    expect(editor).toContain("Send test notification");
  });

  it("documents migration filename and schema fields", () => {
    const migration = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260731_lead_notifications_inbox.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("notification_email");
    expect(migration).toContain("email_notifications_enabled");
    expect(migration).toContain("email_subject_template");
    expect(migration).toContain("last_notification_error");
    expect(migration).toContain("last_notification_at");
    expect(migration).toContain("is_starred");
    expect(migration).toContain("internal_notes");
    expect(migration).toContain("notification_status");
    expect(migration).toContain("notification_provider_message_id");
    expect(migration).toContain("revoke select on public.lead_forms from anon");
  });

  it("keeps email provider secrets server-only", () => {
    const create = readFileSync(
      resolve(__dirname, "./create-provider.ts"),
      "utf8",
    );
    expect(create).toContain("EMAIL_PROVIDER");
    expect(create).not.toContain("NEXT_PUBLIC_EMAIL");
    expect(create).not.toContain("NEXT_PUBLIC_RESEND");

    const envExample = readFileSync(
      resolve(__dirname, "../../.env.example"),
      "utf8",
    );
    expect(envExample).toContain("EMAIL_PROVIDER=mock");
    expect(envExample).toContain("RESEND_API_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExample).not.toContain("NEXT_PUBLIC_RESEND_API_KEY");
  });

  it("documents queue extension point", () => {
    const delivery = readFileSync(
      resolve(__dirname, "./deliver-lead-notification.ts"),
      "utf8",
    );
    expect(delivery).toContain("Future queue extension point");
    expect(delivery).toContain("scheduleLeadNotificationDelivery");
  });
});
