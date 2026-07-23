import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started — Atlas",
  description:
    "Tell Atlas about your business so we can generate your professional website.",
};

/**
 * Onboarding route layout — scoped metadata for the product flow.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
