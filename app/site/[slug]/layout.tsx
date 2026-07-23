import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Published Site — Atlas",
  description: "Read-only preview of your published Atlas website.",
};

/**
 * Published site layout — no dashboard/editor chrome.
 */
export default function PublishedSiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
