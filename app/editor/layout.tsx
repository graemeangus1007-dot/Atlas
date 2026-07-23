import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Editor — Atlas",
  description: "Edit your generated Atlas website content inline.",
};

/**
 * Editor route layout — scoped metadata for the website editor.
 */
export default function EditorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
