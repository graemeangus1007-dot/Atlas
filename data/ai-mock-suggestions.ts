/**
 * Mock AI copy catalogs.
 * Consumed only by `lib/ai/*` generators — never import from React UI.
 */

export function mockHeadlineSuggestions(
  current: string,
  businessName: string,
): [string, string, string] {
  if (/coffee|morning|fresh|brew/i.test(current)) {
    return [
      "Beaufort's Favorite Local Coffee Experience",
      "Freshly Brewed Coffee & Homemade Breakfast",
      "Where Great Coffee Starts Every Morning",
    ];
  }

  const first = businessName.split(" ")[0] || "Your";
  return [
    `${first}'s Favorite Local Experience`,
    current.length > 8 ? `${current} — Crafted With Care` : `Welcome to ${businessName}`,
    `Where Great Days Start at ${businessName}`,
  ];
}

export function mockSubheadlineSuggestions(
  _current: string,
  businessName: string,
): [string, string, string] {
  return [
    `Warm hospitality, thoughtful details, and a welcoming space at ${businessName}.`,
    "Crafted with care for locals, neighbors, and first-time visitors.",
    "Quality you can trust — comfort you can feel.",
  ];
}

export function mockAboutSuggestions(
  _current: string,
  businessName: string,
): [string, string, string] {
  return [
    `${businessName} is a neighborhood favorite known for friendly service, quality ingredients, and a place that feels like home.`,
    `At ${businessName}, every detail is designed to make guests feel welcome — from the first hello to the last visit.`,
    `Discover why the community trusts ${businessName} for everyday moments and special occasions alike.`,
  ];
}

export function mockCtaSuggestions(): [string, string, string] {
  return ["Order Ahead", "Visit Us Today", "Get Started"];
}

export function mockServiceTitleSuggestions(
  current: string,
  businessName: string,
): [string, string, string] {
  return [
    current.length > 2 ? `${current} Plus` : "Signature Service",
    `Premium ${current || "Care"}`,
    `${businessName.split(" ")[0] || "Local"} Favorites`,
  ];
}

export function mockServiceDescriptionSuggestions(
  _current: string,
  businessName: string,
): [string, string, string] {
  return [
    `A thoughtfully crafted offering from ${businessName}, designed to delight every guest.`,
    "Friendly experts, quality ingredients, and results you can count on.",
    "Perfect for everyday visits and special moments alike.",
  ];
}
