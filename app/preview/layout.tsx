import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Preview — Atlas",
  description: "Preview your AI-generated small business website.",
};

/**
 * Preview route layout — metadata for the generated site experience.
 */
export default function PreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
