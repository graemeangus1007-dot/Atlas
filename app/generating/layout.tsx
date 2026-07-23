import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generating Your Website — Atlas",
  description: "Atlas is designing your website using AI.",
};

/**
 * Generation route layout — scoped metadata while the simulated build runs.
 */
export default function GeneratingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
