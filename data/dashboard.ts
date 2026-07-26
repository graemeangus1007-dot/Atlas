/** Dashboard chrome data that is not part of BusinessProject itself. */

import type { AiContentField } from "@/types/ai";

export const MOCK_ACTIVITY = [
  {
    id: "1",
    title: "Created website project",
    time: "Just now",
  },
  {
    id: "2",
    title: "Completed onboarding",
    time: "2 min ago",
  },
  {
    id: "3",
    title: "Homepage generated",
    time: "1 min ago",
  },
] as const;

export type DashboardAiSuggestion = {
  id: string;
  title: string;
  description: string;
  /** Content field the Atlas AI modal should improve. */
  field: AiContentField;
};

export const MOCK_SUGGESTIONS: DashboardAiSuggestion[] = [
  {
    id: "headline",
    title: "Improve homepage headline",
    description:
      "Make your hero message clearer so visitors understand what you offer in seconds.",
    field: "heroHeadline",
  },
  {
    id: "about",
    title: "Strengthen your about section",
    description:
      "Rewrite your business story so visitors quickly understand who you are and why to choose you.",
    field: "description",
  },
  {
    id: "cta",
    title: "Sharpen your call-to-action",
    description:
      "Try clearer CTA wording that encourages visitors to book, call, or get in touch.",
    field: "primaryCta",
  },
];

export const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/editor", label: "Editor", icon: "✏️" },
  { href: "/profile", label: "Profile", icon: "👤" },
] as const;
