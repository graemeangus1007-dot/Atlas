import type { BrowserId, DeviceType } from "@/lib/analytics/types";

export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (!ua) return "other";
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/.test(ua)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua)) {
    return "mobile";
  }
  if (/windows|macintosh|linux|cros|x11/.test(ua)) return "desktop";
  return "other";
}

export function detectBrowser(userAgent: string): BrowserId {
  const ua = userAgent;
  if (!ua) return "Other";
  if (/Edg\//.test(ua) || /Edge\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

export function detectOperatingSystem(userAgent: string): string {
  const ua = userAgent;
  if (!ua) return "Other";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}
