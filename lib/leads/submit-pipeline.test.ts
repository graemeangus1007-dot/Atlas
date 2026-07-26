import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { defaultProjectContact } from "@/lib/contact";
import {
  buildLeadSubmissionInsert,
  leadVisibleInOwnerInbox,
  publishedSubmitPathMatches,
} from "@/lib/leads/submit-insert";
import { toPublicLeadSubmission, rowToLeadSubmission } from "@/lib/leads/serialize";
import { filterLeadsForInbox } from "@/lib/leads/inbox";
import type { BusinessProject } from "@/types/business-project";
import type { LeadSubmissionRow } from "@/lib/leads/types";

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
      formId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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

describe("successful lead insert payload", () => {
  it("builds an insert row with explicit id and pending notification", () => {
    const row = buildLeadSubmissionInsert({
      id: "11111111-1111-1111-1111-111111111111",
      formId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      projectId: "proj-1",
      ownerId: "owner-1",
      validated: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "555-0100",
        company: "Analytical Engines",
        message: "Hello",
        attribution: {
          sessionId: "sess12345678",
          visitorIdHash: "visitorhash",
          landingPage: "/",
          referrer: "https://google.com/",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "spring",
        },
      },
      ipHash: "abc123",
      userAgent: "vitest",
    });

    expect(row.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(row.form_id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(row.project_id).toBe("proj-1");
    expect(row.owner_id).toBe("owner-1");
    expect(row.status).toBe("new");
    expect(row.notification_status).toBe("pending");
    expect(row.email).toBe("ada@example.com");
  });

  it("submit route inserts without anon RETURNING/select", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/forms/[formId]/submit/route.ts"),
      "utf8",
    );
    expect(source).toContain("buildLeadSubmissionInsert");
    expect(source).toContain("randomUUID");
    expect(source).toContain(".insert(row)");
    // Must not chain select/RETURNING on the insert — anon RLS forbids SELECT.
    expect(source).not.toContain(".insert(row).select");
    expect(source).not.toContain(".insert(row)\n      .select");
    expect(source).toContain("logLeadPipeline");
    expect(source).toContain("submit.insert_verified");
  });
});

describe("dashboard visibility", () => {
  it("shows a submission only for matching project_id and owner_id", () => {
    expect(
      leadVisibleInOwnerInbox({
        submissionProjectId: "proj-1",
        submissionOwnerId: "owner-1",
        queryProjectId: "proj-1",
        queryOwnerId: "owner-1",
      }),
    ).toBe(true);

    expect(
      leadVisibleInOwnerInbox({
        submissionProjectId: "proj-1",
        submissionOwnerId: "owner-1",
        queryProjectId: "proj-2",
        queryOwnerId: "owner-1",
      }),
    ).toBe(false);

    expect(
      leadVisibleInOwnerInbox({
        submissionProjectId: "proj-1",
        submissionOwnerId: "owner-1",
        queryProjectId: "proj-1",
        queryOwnerId: "owner-2",
      }),
    ).toBe(false);
  });

  it("maps inserted rows into the inbox list", () => {
    const dbRow: LeadSubmissionRow = {
      id: "11111111-1111-1111-1111-111111111111",
      form_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      project_id: "proj-1",
      owner_id: "owner-1",
      name: "Ada",
      email: "ada@example.com",
      phone: null,
      company: null,
      message: "Hi",
      metadata: {},
      ip_hash: "secret-hash",
      user_agent: null,
      status: "new",
      is_starred: false,
      internal_notes: "",
      notification_status: "pending",
      notification_attempted_at: null,
      notification_sent_at: null,
      notification_error: null,
      notification_provider_message_id: null,
      created_at: "2026-07-26T15:00:00.000Z",
    };

    const publicLead = toPublicLeadSubmission(rowToLeadSubmission(dbRow));
    expect(publicLead.email).toBe("ada@example.com");
    expect((publicLead as { ipHash?: string }).ipHash).toBeUndefined();

    const inbox = filterLeadsForInbox([publicLead], { status: "all" });
    expect(inbox.total).toBe(1);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.items[0]?.id).toBe(dbRow.id);
  });
});

describe("RLS read path contracts", () => {
  it("documents anon insert + owner select policies", () => {
    const migration = readFileSync(
      resolve(__dirname, "../../supabase/migrations/20260730_lead_forms.sql"),
      "utf8",
    );
    expect(migration).toContain("Public can insert submissions to enabled forms");
    expect(migration).toContain("Owners can select own lead submissions");
    expect(migration).toContain("auth.uid() = owner_id");
    // Anon must never get a SELECT policy on submissions.
    expect(migration).toContain(
      "No SELECT policy for anon — public website can never read submissions.",
    );
    expect(migration).not.toContain(
      'create policy "Public can select lead submissions"',
    );
  });

  it("list and unread-count use the same project_id + owner_id filters", () => {
    const list = readFileSync(
      resolve(__dirname, "../../app/api/leads/route.ts"),
      "utf8",
    );
    const unread = readFileSync(
      resolve(__dirname, "../../app/api/leads/unread-count/route.ts"),
      "utf8",
    );
    expect(list).toContain('.eq("project_id", projectId)');
    expect(list).toContain('.eq("owner_id", user.id)');
    expect(unread).toContain('.eq("project_id", projectId)');
    expect(unread).toContain('.eq("owner_id", user.id)');
    expect(unread).toContain('.eq("status", "new")');
    expect(list).toContain("inbox.list_query_ok");
    expect(unread).toContain("inbox.unread_ok");
  });
});

describe("published form integration", () => {
  it("embeds the correct /api/forms/{formId}/submit endpoint", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://atlas.example.com";
    try {
      const project = sampleProject();
      const artifact = buildStaticSite(project);
      const html = artifact.files.find((f) => f.path === "index.html")?.content;
      expect(html).toBeTruthy();
      expect(
        publishedSubmitPathMatches(
          "https://atlas.example.com",
          "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          html!,
        ),
      ).toBe(true);
      expect(html).toContain(
        "https://atlas.example.com/api/forms/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/submit",
      );
      expect(html).toContain('result.res.ok && result.body && result.body.success');
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});
