import type {
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import type {
  CompleteWebsitePlan,
  CreativeDirectorRecommendation,
  CreativeDirectorReport,
} from "@/lib/ai/creative-director-types";
import type { CritiqueImprovementCard } from "@/lib/ai/critique-message-presentation";
import type { ConversationAttachment } from "@/lib/ai/conversation-attachments";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

export type AtlasPanelView = "conversation" | "plan" | "review" | "changes";

export type AtlasAiUiStatus =
  | "idle"
  | "sending"
  | "applied"
  | "no_changes"
  | "needs_clarification"
  | "failed";

export type RecommendationApplyUiStatus =
  | "idle"
  | "applying"
  | "applied"
  | "failed"
  | "no_visible_change";

export type RecommendationApplyState = {
  status: RecommendationApplyUiStatus;
  message?: string | null;
  requestId?: string | null;
};

export type AtlasAiPanelProps = {
  project: BusinessProject;
  projectId?: string | null;
  messages: EditorConversationMessage[];
  status: AtlasAiUiStatus;
  statusMessage?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  lastChanges: EditChangeSummary[] | null;
  advisorReport?: BusinessAdvisorReport | null;
  creativeDirectorReport?: CreativeDirectorReport | null;
  completeWebsitePlan?: CompleteWebsitePlan | null;
  applyingRecommendationId?: string | null;
  recommendationStates?: Record<string, RecommendationApplyState>;
  onSend: (
    request: string,
    attachments?: ConversationAttachment[],
  ) => void;
  /** Merge freshly uploaded media into the project library. */
  onMediaAssetsAdded?: (assets: MediaAsset[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplyRecommendation?: (recommendation: BusinessRecommendation) => void;
  onApplyCreativeRecommendation?: (
    recommendation: CreativeDirectorRecommendation,
  ) => void;
  onCompleteWebsite?: () => void;
  onApplyAllCreative?: () => void;
  onDismissCompletePlan?: () => void;
  followUpSuggestions?: string[];
  onFollowUpSuggestion?: (suggestion: string) => void;
  onClearConversation?: () => void;
  onNewConversation?: () => void;
};

export type ActivePlanSnapshot = {
  improvements: CritiqueImprovementCard[];
  applyAllReady: boolean;
  designDirection: string | null;
  executiveSummary: string;
};
