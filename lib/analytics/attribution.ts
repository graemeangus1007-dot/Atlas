import type { TrafficSourceId } from "@/lib/analytics/types";

/**
 * Attribute a visit to a traffic source from referrer + UTM.
 */
export function attributeTrafficSource(input: {
  referrer: string;
  utmSource: string;
  utmMedium: string;
}): TrafficSourceId {
  const utm = input.utmSource.trim().toLowerCase();
  const medium = input.utmMedium.trim().toLowerCase();

  if (utm) {
    if (utm.includes("google")) return "google";
    if (utm.includes("bing")) return "bing";
    if (utm.includes("facebook") || utm === "fb") return "facebook";
    if (utm.includes("instagram") || utm === "ig") return "instagram";
    if (utm.includes("linkedin") || utm === "li") return "linkedin";
    if (medium === "referral") return "referral";
    return "other";
  }

  const ref = input.referrer.trim();
  if (!ref) return "direct";

  let host = "";
  try {
    host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }

  if (!host) return "direct";
  if (host.includes("google.")) return "google";
  if (host.includes("bing.")) return "bing";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("linkedin.com") || host.includes("lnkd.in")) {
    return "linkedin";
  }
  return "referral";
}

export const TRAFFIC_SOURCE_LABELS: Record<TrafficSourceId, string> = {
  direct: "Direct",
  google: "Google",
  bing: "Bing",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  referral: "Referral",
  other: "Other",
};
