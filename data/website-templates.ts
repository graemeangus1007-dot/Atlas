import type { BusinessType } from "@/types/business";
import type { BusinessTypeTemplate } from "@/types/website-content";

/**
 * Industry templates for dynamic website generation.
 * Content lives here — not inside React components.
 */
export const BUSINESS_TYPE_TEMPLATES: Record<
  BusinessType,
  BusinessTypeTemplate
> = {
  "Coffee Shop": {
    accentColor: "#c4a484",
    headline: "Fresh Coffee Made Daily",
    subheadline:
      "Specialty drinks, warm breakfast plates, and pastries baked every morning.",
    primaryCta: "Order Ahead",
    secondaryCta: "View Menu",
    aboutTitle: "Our café",
    services: [
      {
        title: "Espresso",
        description: "Handcrafted espresso drinks made with seasonal beans.",
      },
      {
        title: "Breakfast",
        description: "Fresh morning plates to start your day the right way.",
      },
      {
        title: "Pastries",
        description: "Locally baked sweets available all day long.",
      },
    ],
    features: [
      {
        title: "House Roasts",
        description: "Carefully sourced beans roasted for balanced flavor.",
      },
      {
        title: "Cozy Seating",
        description: "A welcoming space to work, catch up, or unwind.",
      },
      {
        title: "Community Hub",
        description: "A neighborhood favorite for regulars and first-timers.",
      },
    ],
    galleryLabels: ["Espresso Bar", "Morning Light", "Pastry Case", "Corner Table"],
    contactDescription:
      "Stop by for a cup, or message us to reserve a table for your next meetup.",
  },
  Restaurant: {
    accentColor: "#d45d4c",
    headline: "Dining Worth Remembering",
    subheadline:
      "Seasonal plates, warm hospitality, and an atmosphere made for gathering.",
    primaryCta: "Reserve a Table",
    secondaryCta: "See the Menu",
    aboutTitle: "Our kitchen",
    services: [
      {
        title: "Lunch",
        description: "Midday favorites prepared with fresh, seasonal ingredients.",
      },
      {
        title: "Dinner",
        description: "An evening menu designed for unforgettable meals.",
      },
      {
        title: "Catering",
        description: "Custom menus for celebrations, offices, and events.",
      },
    ],
    features: [
      {
        title: "Seasonal Menu",
        description: "Dishes that change with the freshest local produce.",
      },
      {
        title: "Chef's Specials",
        description: "Limited plates that showcase our kitchen's creativity.",
      },
      {
        title: "Private Dining",
        description: "Thoughtful spaces for birthdays, meetings, and more.",
      },
    ],
    galleryLabels: ["Dining Room", "Chef's Table", "Garden Patio", "Plated Course"],
    contactDescription:
      "Book a table or ask about private dining — we'd love to host you.",
  },
  "Retail Store": {
    accentColor: "#5b8def",
    headline: "Discover What You Love",
    subheadline:
      "Curated products, helpful service, and a shopping experience that feels personal.",
    primaryCta: "Shop Now",
    secondaryCta: "Browse Collections",
    aboutTitle: "Our store",
    services: [
      {
        title: "Curated Products",
        description: "Hand-selected goods that match everyday style and quality.",
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
    features: [
      {
        title: "New Arrivals",
        description: "Fresh finds added regularly so there's always something new.",
      },
      {
        title: "Local Makers",
        description: "Support independent creators with unique pieces.",
      },
      {
        title: "Easy Returns",
        description: "Straightforward policies that keep shopping stress-free.",
      },
    ],
    galleryLabels: ["Front Display", "Featured Shelf", "Fitting Corner", "Gift Desk"],
    contactDescription:
      "Visit the shop or reach out — we're happy to help you find the perfect piece.",
  },
  Salon: {
    accentColor: "#c77db5",
    headline: "Look and Feel Your Best",
    subheadline:
      "Expert styling, restorative treatments, and appointments that fit your schedule.",
    primaryCta: "Book Appointment",
    secondaryCta: "Explore Services",
    aboutTitle: "Our salon",
    services: [
      {
        title: "Hair Styling",
        description: "Cuts, color, and finishes tailored to your look.",
      },
      {
        title: "Treatments",
        description: "Restorative care for healthy, polished results.",
      },
      {
        title: "Appointments",
        description: "Easy booking designed for busy schedules.",
      },
    ],
    features: [
      {
        title: "Expert Stylists",
        description: "A team trained in modern techniques and classic craft.",
      },
      {
        title: "Premium Products",
        description: "Salon-quality formulas that protect and enhance.",
      },
      {
        title: "Relaxing Space",
        description: "A calm studio where every visit feels like a reset.",
      },
    ],
    galleryLabels: ["Styling Chairs", "Color Bar", "Wash Station", "Reception"],
    contactDescription:
      "Ready for a refresh? Book online or call us to find your next opening.",
  },
  Gym: {
    accentColor: "#3ecf8e",
    headline: "Reach Your Fitness Goals",
    subheadline:
      "Coaching, classes, and memberships built to keep you motivated and moving.",
    primaryCta: "Start Your Membership",
    secondaryCta: "View Classes",
    aboutTitle: "Our gym",
    services: [
      {
        title: "Personal Training",
        description: "One-on-one coaching plans built around your goals.",
      },
      {
        title: "Classes",
        description: "Energizing group sessions for every fitness level.",
      },
      {
        title: "Memberships",
        description: "Flexible plans with access to equipment and coaching.",
      },
    ],
    features: [
      {
        title: "Modern Equipment",
        description: "Clean, well-maintained machines ready when you are.",
      },
      {
        title: "Expert Coaches",
        description: "Trainers who help you progress with confidence.",
      },
      {
        title: "Flexible Hours",
        description: "Open early and late so fitness fits your life.",
      },
    ],
    galleryLabels: ["Weight Floor", "Studio Class", "Cardio Zone", "Locker Area"],
    contactDescription:
      "Tour the floor or start your membership today — we'll help you get going.",
  },
  Contractor: {
    accentColor: "#e09b3d",
    headline: "Built with Craft and Care",
    subheadline:
      "Renovations, repairs, and project planning you can trust from start to finish.",
    primaryCta: "Request a Quote",
    secondaryCta: "View Projects",
    aboutTitle: "Our work",
    services: [
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
    features: [
      {
        title: "Licensed Team",
        description: "Experienced professionals who treat your home with respect.",
      },
      {
        title: "Clear Estimates",
        description: "Transparent pricing with no surprise add-ons.",
      },
      {
        title: "On-Time Delivery",
        description: "Schedules we communicate early and stick to.",
      },
    ],
    galleryLabels: ["Kitchen Remodel", "Exterior Work", "Workshop", "Finished Detail"],
    contactDescription:
      "Tell us about your project — we'll respond with next steps and a clear estimate.",
  },
  "Real Estate": {
    accentColor: "#4c7fd4",
    headline: "Find Your Next Place",
    subheadline:
      "Buyer guidance, seller strategy, and local insight for every move you make.",
    primaryCta: "Browse Listings",
    secondaryCta: "Talk to an Agent",
    aboutTitle: "Our approach",
    services: [
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
    features: [
      {
        title: "Local Experts",
        description: "Neighborhood knowledge that helps you decide faster.",
      },
      {
        title: "Smart Marketing",
        description: "Photography and listings that get properties noticed.",
      },
      {
        title: "Smooth Closings",
        description: "Guided paperwork and timelines without the stress.",
      },
    ],
    galleryLabels: ["Featured Home", "Open House", "City Skyline", "Closing Day"],
    contactDescription:
      "Buying or selling? Reach out and we'll help you plan the next step.",
  },
  Other: {
    accentColor: "#3db8a8",
    headline: "Built for Your Customers",
    subheadline:
      "A polished online presence that introduces your business with clarity and confidence.",
    primaryCta: "Get in Touch",
    secondaryCta: "Learn More",
    aboutTitle: "About us",
    services: [
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
    features: [
      {
        title: "Clear Messaging",
        description: "Visitors understand what you offer in seconds.",
      },
      {
        title: "Trusted Presence",
        description: "A professional look that builds credibility online.",
      },
      {
        title: "Easy Contact",
        description: "Simple paths for customers to reach you anytime.",
      },
    ],
    galleryLabels: ["Workspace", "Team", "Highlights", "Details"],
    contactDescription:
      "We'd love to hear from you. Reach out any time with questions.",
  },
};
