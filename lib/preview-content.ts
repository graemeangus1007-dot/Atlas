import type { BusinessType } from "@/components/onboarding/types";

export type PreviewService = {
  title: string;
  description: string;
};

export type PreviewContactDetail = {
  label: string;
  value: string;
};

export type PreviewGalleryItem = {
  id: string;
  label: string;
  tone: string;
};

const SERVICES_BY_TYPE: Record<BusinessType, PreviewService[]> = {
  "Coffee Shop": [
    {
      title: "Specialty Coffee",
      description: "Espresso drinks and pour-overs crafted with seasonal beans.",
    },
    {
      title: "Fresh Breakfast",
      description: "Morning favorites made fresh to start your day right.",
    },
    {
      title: "Local Pastries",
      description: "Baked goods from local kitchens, available all day.",
    },
  ],
  Restaurant: [
    {
      title: "Lunch",
      description: "Seasonal midday plates prepared with fresh ingredients.",
    },
    {
      title: "Dinner",
      description: "An evening menu designed for memorable meals.",
    },
    {
      title: "Catering",
      description: "Custom menus for gatherings, offices, and celebrations.",
    },
  ],
  "Retail Store": [
    {
      title: "Curated Products",
      description: "Hand-selected goods that match your everyday style.",
    },
    {
      title: "Personal Shopping",
      description: "One-on-one help finding exactly what you need.",
    },
    {
      title: "Gift Wrapping",
      description: "Thoughtful packaging for birthdays and special occasions.",
    },
  ],
  Salon: [
    {
      title: "Hair Styling",
      description: "Cuts, color, and finishes tailored to you.",
    },
    {
      title: "Treatments",
      description: "Restorative care for healthy, polished results.",
    },
    {
      title: "Appointments",
      description: "Easy booking for busy schedules.",
    },
  ],
  Gym: [
    {
      title: "Personal Training",
      description: "Coaching plans built around your goals.",
    },
    {
      title: "Classes",
      description: "Group sessions that keep you motivated and moving.",
    },
    {
      title: "Memberships",
      description: "Flexible plans with access to equipment and coaching.",
    },
  ],
  Contractor: [
    {
      title: "Home Renovations",
      description: "Quality craftsmanship for kitchens, baths, and more.",
    },
    {
      title: "Repairs",
      description: "Reliable fixes that protect your property long-term.",
    },
    {
      title: "Project Planning",
      description: "Clear timelines and estimates before work begins.",
    },
  ],
  "Real Estate": [
    {
      title: "Buyer Guidance",
      description: "Support from first tour through closing day.",
    },
    {
      title: "Seller Strategy",
      description: "Pricing, staging, and marketing that attract offers.",
    },
    {
      title: "Market Insights",
      description: "Local trends so you can move with confidence.",
    },
  ],
  Other: [
    {
      title: "Core Services",
      description: "The essentials your customers look for first.",
    },
    {
      title: "Consultations",
      description: "Friendly guidance to help people get started.",
    },
    {
      title: "Support",
      description: "Follow-up care that keeps relationships strong.",
    },
  ],
};

/**
 * Placeholder services derived from the selected onboarding business type.
 */
export function getServicesForType(
  businessType: BusinessType | "",
): PreviewService[] {
  return SERVICES_BY_TYPE[businessType || "Other"] ?? SERVICES_BY_TYPE.Other;
}

export const PREVIEW_CONTACT_DETAILS: PreviewContactDetail[] = [
  { label: "Phone", value: "(555) 014-2088" },
  { label: "Email", value: "hello@example.com" },
  { label: "Location", value: "128 Harbor Street, Riverview" },
];

export const PREVIEW_GALLERY: PreviewGalleryItem[] = [
  { id: "1", label: "Storefront", tone: "from-accent/30 to-surface" },
  { id: "2", label: "Interior", tone: "from-sky-500/20 to-surface" },
  { id: "3", label: "Team", tone: "from-amber-500/20 to-surface" },
  { id: "4", label: "Highlights", tone: "from-violet-500/15 to-surface" },
];
