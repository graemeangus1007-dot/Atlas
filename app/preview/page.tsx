import { WebsitePreview } from "@/components/preview";

/**
 * /preview — view the active site outside the editor chrome.
 * Not a creation path — New Site always starts at /onboarding.
 */
export default function PreviewPage() {
  return <WebsitePreview />;
}
