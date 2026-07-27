import type { BusinessType, WebsiteGoal } from "@/types/business";
import type { ProjectStatus } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import type {
  PublishVersionInsert,
  PublishVersionRow,
} from "@/lib/publishing/publish-version-types";
import type {
  ProjectDomainInsert,
  ProjectDomainRow,
  ProjectDomainUpdate,
} from "@/lib/domains/types";
import type { DeviceType } from "@/lib/analytics/types";
import type { LeadFormRow, LeadSubmissionRow } from "@/lib/leads/types";

export type SiteVisitRowDb = {
  id: string;
  project_id: string;
  owner_id: string;
  session_id: string;
  visitor_id: string;
  page_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  country: string;
  region: string;
  city: string;
  device_type: DeviceType;
  browser: string;
  operating_system: string;
  screen_size: string;
  language: string;
  duration_seconds: number;
  bounced: boolean;
  created_at: string;
};

export type PageViewRowDb = {
  id: string;
  visit_id: string;
  project_id: string;
  page_path: string;
  timestamp: string;
};

/** JSON object stored in public.projects.content */
export type ProjectContentJson = Record<string, unknown>;

/** JSON object stored in public.projects.branding */
export type ProjectBrandingJson = Record<string, unknown>;

/** Row shape for public.projects (matches the SQL migration). */
export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  business_name: string;
  business_type: string | null;
  description: string | null;
  goals: WebsiteGoal[];
  content: ProjectContentJson;
  branding: ProjectBrandingJson;
  template: string | null;
  media: MediaAsset[];
  status: ProjectStatus;
  published_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields accepted when inserting a project row. */
export type ProjectInsert = {
  id?: string;
  owner_id: string;
  name: string;
  business_name: string;
  business_type?: string | null;
  description?: string | null;
  goals?: WebsiteGoal[];
  content?: ProjectContentJson;
  branding?: ProjectBrandingJson;
  template?: string | null;
  media?: MediaAsset[];
  status?: ProjectStatus;
  published_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Fields accepted when updating a project row. */
export type ProjectUpdate = {
  id?: string;
  owner_id?: string;
  name?: string;
  business_name?: string;
  business_type?: string | null;
  description?: string | null;
  goals?: WebsiteGoal[];
  content?: ProjectContentJson;
  branding?: ProjectBrandingJson;
  template?: string | null;
  media?: MediaAsset[];
  status?: ProjectStatus;
  published_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Visual sources used by project card thumbnails. */
export type ProjectListThumbnail = {
  screenshotUrl: string | null;
  coverImageUrl: string | null;
  heroImageUrl: string | null;
  /**
   * Durable private-bucket path for the hero image.
   * Used to re-issue signed display URLs when heroImageUrl expires.
   */
  heroStoragePath: string | null;
  /** When the current heroImageUrl should be refreshed (epoch ms). */
  heroUrlExpiresAt: number | null;
  previewUrl: string | null;
  accentColor: string | null;
  /** True when heroImageUrl is a session-only blob: URL (not durable across refresh). */
  heroIsBlobUrl: boolean;
};

/** Lightweight list item for dashboard / projects cards. */
export type ProjectListItem = {
  id: string;
  name: string;
  businessName: string;
  businessType: BusinessType | string;
  description: string;
  status: ProjectStatus;
  publishedUrl: string | null;
  updatedAt: string;
  createdAt: string;
  thumbnail: ProjectListThumbnail;
};

/** Typed success / failure wrapper for project data-access calls. */
export type ProjectResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_draft_creations: {
        Row: {
          owner_id: string;
          idempotency_key: string;
          project_id: string;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          idempotency_key: string;
          project_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ai_draft_creations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      publish_versions: {
        Row: PublishVersionRow;
        Insert: PublishVersionInsert;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "publish_versions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publish_versions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      project_domains: {
        Row: ProjectDomainRow;
        Insert: ProjectDomainInsert;
        Update: ProjectDomainUpdate;
        Relationships: [
          {
            foreignKeyName: "project_domains_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_domains_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_forms: {
        Row: LeadFormRow;
        Insert: Partial<LeadFormRow> &
          Pick<LeadFormRow, "project_id" | "owner_id" | "name">;
        Update: Partial<
          Pick<
            LeadFormRow,
            | "name"
            | "description"
            | "success_message"
            | "is_enabled"
            | "notification_email"
            | "email_notifications_enabled"
            | "email_subject_template"
            | "last_notification_error"
            | "last_notification_at"
          >
        >;
        Relationships: [
          {
            foreignKeyName: "lead_forms_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      site_visits: {
        Row: SiteVisitRowDb;
        Insert: Partial<SiteVisitRowDb> &
          Pick<
            SiteVisitRowDb,
            | "project_id"
            | "owner_id"
            | "session_id"
            | "visitor_id"
            | "page_path"
          >;
        Update: Partial<
          Pick<
            SiteVisitRowDb,
            "duration_seconds" | "bounced" | "page_path"
          >
        >;
        Relationships: [];
      };
      page_views: {
        Row: PageViewRowDb;
        Insert: Partial<PageViewRowDb> &
          Pick<PageViewRowDb, "visit_id" | "project_id" | "page_path">;
        Update: never;
        Relationships: [];
      };
      lead_submissions: {
        Row: LeadSubmissionRow;
        Insert: Omit<
          LeadSubmissionRow,
          | "id"
          | "created_at"
          | "status"
          | "is_starred"
          | "internal_notes"
          | "notification_status"
          | "notification_attempted_at"
          | "notification_sent_at"
          | "notification_error"
          | "notification_provider_message_id"
        > & {
          id?: string;
          status?: LeadSubmissionRow["status"];
          created_at?: string;
          is_starred?: boolean;
          internal_notes?: string;
          notification_status?: LeadSubmissionRow["notification_status"];
          notification_attempted_at?: string | null;
          notification_sent_at?: string | null;
          notification_error?: string | null;
          notification_provider_message_id?: string | null;
        };
        Update: Partial<
          Pick<
            LeadSubmissionRow,
            | "status"
            | "is_starred"
            | "internal_notes"
            | "notification_status"
            | "notification_attempted_at"
            | "notification_sent_at"
            | "notification_error"
            | "notification_provider_message_id"
          >
        >;
        Relationships: [
          {
            foreignKeyName: "lead_submissions_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "lead_forms";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_customers: {
        Row: {
          owner_id: string;
          stripe_customer_id: string;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          stripe_customer_id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stripe_customer_id?: string;
          email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          owner_id: string;
          plan: "starter" | "professional" | "agency";
          status:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "incomplete"
            | "incomplete_expired"
            | "paused"
            | "none";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          cancel_at_period_end: boolean;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          feature_flags: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          plan?: "starter" | "professional" | "agency";
          status?:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "incomplete"
            | "incomplete_expired"
            | "paused"
            | "none";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          cancel_at_period_end?: boolean;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          feature_flags?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: "starter" | "professional" | "agency";
          status?:
            | "trialing"
            | "active"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "incomplete"
            | "incomplete_expired"
            | "paused"
            | "none";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          cancel_at_period_end?: boolean;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          feature_flags?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          type: string;
          processed_at: string;
          livemode: boolean;
          payload_digest: string | null;
        };
        Insert: {
          id: string;
          type: string;
          processed_at?: string;
          livemode?: boolean;
          payload_digest?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      project_owner_id: {
        Args: { p_project_id: string };
        Returns: string | null;
      };
      ensure_free_subscription: {
        Args: { p_owner_id: string };
        Returns: {
          owner_id: string;
          plan: "starter" | "professional" | "agency";
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          cancel_at_period_end: boolean;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          feature_flags: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
      };
      atlas_record_analytics_event: {
        Args: {
          p_event: string;
          p_project_id: string;
          p_session_id: string;
          p_visitor_id: string;
          p_page_path: string;
          p_referrer?: string;
          p_utm_source?: string;
          p_utm_medium?: string;
          p_utm_campaign?: string;
          p_device_type?: string;
          p_browser?: string;
          p_operating_system?: string;
          p_screen_size?: string;
          p_language?: string;
          p_duration_seconds?: number;
        };
        Returns: {
          ok?: boolean;
          error?: string;
          visit_id?: string | null;
          created_visit?: boolean;
          created_page_view?: boolean;
          duration_seconds?: number;
          bounced?: boolean;
          skipped?: boolean;
        };
      };
    };
    Enums: Record<string, never>;
  };
};

export type SupabasePublicEnv = {
  url: string;
  /** Public API key — prefer publishable key; falls back to legacy anon key. */
  publishableKey: string;
};

/**
 * Resolve Supabase public env vars.
 * Prefers NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabaseEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url && !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add both to .env.local (see .env.example).",
    );
  }

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local from your Supabase project settings.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add it to .env.local from your Supabase project settings (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted).",
    );
  }

  if (isPlaceholderValue(url) || isPlaceholderValue(publishableKey)) {
    throw new Error(
      "Supabase env vars still use placeholder values. Replace them in .env.local with your real project URL and publishable key.",
    );
  }

  return { url, publishableKey };
}

function isPlaceholderValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("your_project") ||
    lower.includes("your-project") ||
    lower.includes("your_anon") ||
    lower.includes("your-anon") ||
    lower.includes("your-anon-key") ||
    lower.includes("your_publishable") ||
    lower.includes("your-publishable") ||
    lower.includes("example.supabase.co")
  );
}

export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseEnv();
    return true;
  } catch {
    return false;
  }
}
