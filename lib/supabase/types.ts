import type { BusinessType, WebsiteGoal } from "@/types/business";
import type { ProjectStatus } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

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

/** Lightweight list item for dashboard / projects cards. */
export type ProjectListItem = {
  id: string;
  name: string;
  businessName: string;
  businessType: BusinessType | string;
  status: ProjectStatus;
  publishedUrl: string | null;
  updatedAt: string;
  createdAt: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
