/**
 * Industry content packs with deterministic variations (Sprint 20.1).
 * Seeded by business name so wording is stable per business but not identical
 * across industries / names.
 */

export type IndustryCategory =
  | "restaurant"
  | "cafe"
  | "plumber"
  | "electrician"
  | "dentist"
  | "gym"
  | "landscaper"
  | "law_firm"
  | "photographer"
  | "marketing_agency"
  | "software"
  | "general";

export type IndustryCopyPack = {
  category: IndustryCategory;
  headlines: string[];
  subheadlines: string[];
  primaryCtas: string[];
  secondaryCtas: string[];
  aboutOpeners: string[];
  serviceBlurb: (service: string, audience: string, area: string) => string;
  seoTitle: (name: string, type: string) => string;
  seoDescription: (name: string, description: string) => string;
  galleryLabels: string[];
};

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick a stable variation from a list using a seed string. */
export function pickVariation<T>(items: readonly T[], seed: string, salt = 0): T {
  if (items.length === 0) {
    throw new Error("pickVariation requires a non-empty list");
  }
  const index = (hashSeed(`${seed}:${salt}`) + salt) % items.length;
  return items[index]!;
}

const CATEGORY_MATCHERS: Array<{ match: RegExp; category: IndustryCategory }> = [
  { match: /\b(restaurant|bistro|diner|eatery|steakhouse)\b/i, category: "restaurant" },
  { match: /\b(cafe|café|coffee|bakery|espresso)\b/i, category: "cafe" },
  { match: /\b(plumb)/i, category: "plumber" },
  { match: /\b(electric)/i, category: "electrician" },
  { match: /\b(dent|orthodont|oral)/i, category: "dentist" },
  { match: /\b(gym|fitness|crossfit|yoga|pilates)\b/i, category: "gym" },
  { match: /\b(landscap|lawn|garden|hardscape)/i, category: "landscaper" },
  { match: /\b(law|attorney|legal|solicitor)\b/i, category: "law_firm" },
  { match: /\b(photo|portrait|wedding photograph)\b/i, category: "photographer" },
  {
    match: /\b(marketing|advertis|branding agency|digital agency)\b/i,
    category: "marketing_agency",
  },
  {
    match: /\b(software|saas|app|developer|technology|tech company)\b/i,
    category: "software",
  },
];

export function detectIndustryCategory(businessType: string): IndustryCategory {
  const text = businessType.trim();
  for (const row of CATEGORY_MATCHERS) {
    if (row.match.test(text)) return row.category;
  }
  return "general";
}

function blurb(
  templates: string[],
  service: string,
  audience: string,
  area: string,
  seed: string,
): string {
  const t = pickVariation(templates, seed, service.length);
  return t
    .replaceAll("{service}", service)
    .replaceAll("{audience}", audience || "customers who value quality")
    .replaceAll("{area}", area ? ` across ${area}` : "");
}

const PACKS: Record<IndustryCategory, Omit<IndustryCopyPack, "category" | "serviceBlurb"> & {
  serviceTemplates: string[];
}> = {
  restaurant: {
    headlines: [
      "A table worth dressing up for",
      "Seasonal plates, warm hospitality",
      "Where neighbors become regulars",
    ],
    subheadlines: [
      "Scratch-made dishes and a dining room built for lingering conversations.",
      "From weeknight comfort to weekend celebrations — always cooked with care.",
    ],
    primaryCtas: ["Reserve a table", "View the menu", "Book tonight"],
    secondaryCtas: ["See tonight's specials", "Plan a private event"],
    aboutOpeners: [
      "We cook with local ingredients and old-fashioned attention.",
      "Our kitchen focuses on honest flavors and generous portions.",
    ],
    serviceTemplates: [
      "Our {service} is crafted for {audience}{area}.",
      "{service} prepared fresh — ideal for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type} & Reservations`,
    seoDescription: (name, description) =>
      `${description || `${name} serves seasonal dishes in a welcoming dining room.`} Reserve your table today.`,
    galleryLabels: ["Signature dish", "Dining room", "Chef's prep", "Weekend brunch"],
  },
  cafe: {
    headlines: [
      "Your neighborhood coffee ritual",
      "Espresso, pastries, and soft mornings",
      "Brewed slow. Served with a smile.",
    ],
    subheadlines: [
      "Specialty drinks and fresh bakes for remote workers and weekend lingerers.",
      "A calm corner for first meetings, laptop sessions, and second cups.",
    ],
    primaryCtas: ["Order ahead", "See the menu", "Visit us today"],
    secondaryCtas: ["Explore drinks", "Catering inquiry"],
    aboutOpeners: [
      "We roast and brew with care so every cup tastes intentional.",
      "Our baristas obsess over texture, temperature, and a friendly hello.",
    ],
    serviceTemplates: [
      "{service} made for {audience}{area}.",
      "Enjoy {service} crafted daily for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} serves specialty coffee and fresh pastries in a welcoming café.`,
    galleryLabels: ["Latte art", "Pastry case", "Café seating", "Morning rush"],
  },
  plumber: {
    headlines: [
      "Fast, fair plumbing — done right",
      "Leaks stop here",
      "Reliable plumbing for busy homes",
    ],
    subheadlines: [
      "Licensed technicians for emergencies, installs, and preventive maintenance.",
      "Clear pricing, tidy work, and same-day options when you need them most.",
    ],
    primaryCtas: ["Call for service", "Get a free quote", "Book a visit"],
    secondaryCtas: ["View services", "Emergency help"],
    aboutOpeners: [
      "We treat every home like our own — clean workspaces and honest recommendations.",
      "Our team solves plumbing problems quickly without the upsell pressure.",
    ],
    serviceTemplates: [
      "Professional {service} for {audience}{area}.",
      "Dependable {service} with clear pricing for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | Local ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} provides trusted plumbing repair and installation for homes and businesses.`,
    galleryLabels: ["Van & tools", "Fixture install", "Pipe repair", "Happy homeowner"],
  },
  electrician: {
    headlines: [
      "Safe power. Clean installs.",
      "Electrical work you can trust",
      "Brighten every room — safely",
    ],
    subheadlines: [
      "Residential and light-commercial electrical services with code-compliant craftsmanship.",
      "Panels, lighting, EV chargers, and troubleshooting — handled by licensed pros.",
    ],
    primaryCtas: ["Request a quote", "Schedule service", "Call an electrician"],
    secondaryCtas: ["See electrical services", "Safety inspection"],
    aboutOpeners: [
      "Safety and clarity guide every job — from diagnosis to final walkthrough.",
      "We explain options in plain language and leave spaces cleaner than we found them.",
    ],
    serviceTemplates: [
      "Expert {service} for {audience}{area}.",
      "Code-aware {service} tailored to {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type} Services`,
    seoDescription: (name, description) =>
      description ||
      `${name} offers licensed electrical installation, repair, and safety inspections.`,
    galleryLabels: ["Panel upgrade", "Lighting install", "EV charger", "Team on site"],
  },
  dentist: {
    headlines: [
      "Gentle dentistry, modern care",
      "Healthier smiles start here",
      "Comfort-first dental visits",
    ],
    subheadlines: [
      "Preventive care and cosmetic treatments in a calm, patient-first clinic.",
      "From cleanings to smile makeovers — care that respects your time and comfort.",
    ],
    primaryCtas: ["Book an appointment", "New patient special", "Call the office"],
    secondaryCtas: ["Meet the team", "View services"],
    aboutOpeners: [
      "Our clinic pairs modern technology with a gentle chairside manner.",
      "We help patients feel informed and at ease before every procedure.",
    ],
    serviceTemplates: [
      "{service} delivered with comfort in mind for {audience}{area}.",
      "Personalized {service} for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} provides gentle, modern dental care for families and professionals.`,
    galleryLabels: ["Treatment room", "Welcoming lobby", "Smile results", "Care team"],
  },
  gym: {
    headlines: [
      "Train with purpose",
      "Strength starts with showing up",
      "Your fittest chapter begins here",
    ],
    subheadlines: [
      "Coaching, community, and programming that fits real schedules.",
      "Whether you are new or returning — we meet you at your current level.",
    ],
    primaryCtas: ["Start a free trial", "Join today", "Book a consult"],
    secondaryCtas: ["See class schedule", "Tour the gym"],
    aboutOpeners: [
      "We build sustainable habits — not short-lived intensity spikes.",
      "Our coaches focus on form, progress, and a culture that keeps people coming back.",
    ],
    serviceTemplates: [
      "{service} designed for {audience}{area}.",
      "Results-focused {service} for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type} & Training`,
    seoDescription: (name, description) =>
      description ||
      `${name} offers coaching, classes, and strength training for every fitness level.`,
    galleryLabels: ["Open gym floor", "Group class", "Coaching moment", "Member wins"],
  },
  landscaper: {
    headlines: [
      "Outdoor spaces, thoughtfully built",
      "From lawn care to lasting landscapes",
      "Yards that feel like destinations",
    ],
    subheadlines: [
      "Design, planting, and maintenance that raise curb appeal and outdoor living.",
      "Seasonal care and custom hardscapes crafted for how you actually use your yard.",
    ],
    primaryCtas: ["Get a landscape quote", "Book a site visit", "Start your project"],
    secondaryCtas: ["View project gallery", "Maintenance plans"],
    aboutOpeners: [
      "We blend practical drainage, plant health, and design that ages gracefully.",
      "Our crews respect your property and communicate clearly from estimate to finish.",
    ],
    serviceTemplates: [
      "Professional {service} for {audience}{area}.",
      "Outdoor-ready {service} tailored to {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} designs and maintains outdoor spaces with quality craftsmanship.`,
    galleryLabels: ["Front yard reveal", "Patio build", "Garden beds", "Seasonal cleanup"],
  },
  law_firm: {
    headlines: [
      "Clear counsel. Steady advocacy.",
      "Legal guidance without the fog",
      "Protect what matters most",
    ],
    subheadlines: [
      "Practical legal strategy with responsive communication at every step.",
      "We help individuals and businesses navigate complex decisions with confidence.",
    ],
    primaryCtas: ["Schedule a consultation", "Contact the firm", "Request a callback"],
    secondaryCtas: ["Practice areas", "Meet our attorneys"],
    aboutOpeners: [
      "We explain options plainly and prepare thoroughly — before you need to decide.",
      "Our firm pairs courtroom readiness with thoughtful, client-centered counsel.",
    ],
    serviceTemplates: [
      "Focused {service} for {audience}{area}.",
      "Strategic {service} supporting {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} provides trusted legal counsel with clear communication and careful strategy.`,
    galleryLabels: ["Conference room", "Courthouse steps", "Team portrait", "Client meeting"],
  },
  photographer: {
    headlines: [
      "Images that feel like memory",
      "Light, story, and real moments",
      "Photography with intention",
    ],
    subheadlines: [
      "Portraits, events, and brand stories captured with a calm, documentary eye.",
      "Natural light, honest emotion, and galleries you will actually revisit.",
    ],
    primaryCtas: ["Check availability", "View the portfolio", "Book a session"],
    secondaryCtas: ["See packages", "Wedding inquiry"],
    aboutOpeners: [
      "I photograph the in-between moments — the glances and gestures that tell the truth.",
      "Sessions stay unhurried so people can settle in and be themselves.",
    ],
    serviceTemplates: [
      "{service} sessions crafted for {audience}{area}.",
      "Story-driven {service} for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} captures portraits and events with natural light and lasting emotion.`,
    galleryLabels: ["Portrait set", "Detail shot", "Event highlight", "Behind the scenes"],
  },
  marketing_agency: {
    headlines: [
      "Brands that earn attention",
      "Strategy, creative, measurable growth",
      "Marketing that respects your audience",
    ],
    subheadlines: [
      "Positioning, campaigns, and content systems built for companies ready to scale.",
      "We connect brand story to pipeline — without noisy gimmicks.",
    ],
    primaryCtas: ["Book a strategy call", "Start a project", "See our work"],
    secondaryCtas: ["Capabilities", "Case studies"],
    aboutOpeners: [
      "We partner like an in-house team: clear goals, honest reporting, and sharp creative.",
      "Our process turns research into campaigns that sound like your best customer already knows you.",
    ],
    serviceTemplates: [
      "{service} programs for {audience}{area}.",
      "High-signal {service} built for {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} helps brands grow with strategy, creative, and measurable campaigns.`,
    galleryLabels: ["Campaign mockup", "Workshop wall", "Analytics board", "Team collab"],
  },
  software: {
    headlines: [
      "Software that stays out of the way",
      "Build faster. Ship clearer.",
      "Product craft for ambitious teams",
    ],
    subheadlines: [
      "Design and engineering that turn fuzzy requirements into reliable releases.",
      "From MVP to scale — interfaces and systems your customers can trust.",
    ],
    primaryCtas: ["Talk to product", "Book a demo", "Start a build"],
    secondaryCtas: ["See platform", "View case studies"],
    aboutOpeners: [
      "We obsess over clarity: clean UX, maintainable code, and outcomes you can measure.",
      "Our team ships iteratively so stakeholders see progress early — and often.",
    ],
    serviceTemplates: [
      "{service} for {audience}{area}.",
      "Product-minded {service} supporting {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description ||
      `${name} builds reliable software products with thoughtful design and engineering.`,
    galleryLabels: ["Product dashboard", "Mobile UI", "Team standup", "Launch metrics"],
  },
  general: {
    headlines: [
      "Trusted service, clearly delivered",
      "Built around your customers",
      "Quality work. Straightforward communication.",
    ],
    subheadlines: [
      "Professional service with transparent process and dependable follow-through.",
      "We help people get results without the runaround.",
    ],
    primaryCtas: ["Get a free quote", "Contact us", "Book a call"],
    secondaryCtas: ["Learn more", "View services"],
    aboutOpeners: [
      "We care about doing careful work and keeping customers informed.",
      "Our reputation comes from consistency — not shortcuts.",
    ],
    serviceTemplates: [
      "Professional {service} for {audience}{area}.",
      "Reliable {service} tailored to {audience}{area}.",
    ],
    seoTitle: (name, type) => `${name} | ${type}`,
    seoDescription: (name, description) =>
      description || `${name} delivers dependable service with clear communication.`,
    galleryLabels: ["Project highlight", "Workspace", "Team", "Customer moment"],
  },
};

export function getIndustryCopyPack(businessType: string): IndustryCopyPack {
  const category = detectIndustryCategory(businessType);
  const pack = PACKS[category];
  return {
    category,
    headlines: pack.headlines,
    subheadlines: pack.subheadlines,
    primaryCtas: pack.primaryCtas,
    secondaryCtas: pack.secondaryCtas,
    aboutOpeners: pack.aboutOpeners,
    galleryLabels: pack.galleryLabels,
    seoTitle: pack.seoTitle,
    seoDescription: pack.seoDescription,
    serviceBlurb: (service, audience, area) =>
      blurb(pack.serviceTemplates, service, audience, area, `${businessType}:${service}`),
  };
}
