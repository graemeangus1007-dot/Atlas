import type { Metadata } from "next";
import AiQuestionnairePage from "@/components/ai/ai-questionnaire-page";

export const metadata: Metadata = {
  title: "AI Website — Atlas",
  description:
    "Answer a short questionnaire and generate a website draft with Atlas AI.",
};

export default function DashboardAiPage() {
  return <AiQuestionnairePage />;
}
