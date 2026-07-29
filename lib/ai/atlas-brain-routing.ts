/**
 * Atlas Brain agent selection (Sprint 26.0A) — deterministic routing.
 */

import { inferMemoryFromMessage } from "@/lib/ai/atlas-brain-memory";
import type {
  AtlasAgentId,
  AtlasBrainDecision,
  AtlasExecutionPlan,
} from "@/lib/ai/atlas-brain-types";
import { ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
import { isImageEditRequest } from "@/lib/ai/image-agent";
import { routeIntent } from "@/lib/ai/intent-router";
import type { BusinessProject } from "@/types/business-project";

export type AtlasBrainRouteInput = {
  request: string;
  project: BusinessProject;
  history?: Array<{ role: string; content: string }>;
};

const FEEL_DIRECTION =
  /\b(feel|feeling|vibe|atmosphere)\s+(more\s+)?(luxurious|luxury|premium|elegant|modern|warm|friendly|bold|minimal|scandinavian|corporate|playful|editorial|industrial|medical)|(\b(look|looking)\s+(more\s+)?(luxurious|luxury|premium|elegant|expensive|modern|minimal)\b)|\bmore\s+(luxurious|luxury|premium|elegant)\b|\bluxur|\b(make\s+(it|this)\s+(more\s+)?(luxurious|luxury|premium|elegant|modern|minimal|friendly|corporate|playful))\b|\b(scandinavian|nordic|apple[- ]?like|design\s+language|boutique\s+feel)\b/i;

const PUBLISH =
  /\b(publish|go\s+live|make\s+(it\s+)?live|deploy(\s+my\s+site)?|launch\s+(my\s+)?(site|website))\b/i;

const RECOMMEND_ONLY =
  /\b(what\s+should\s+i\s+(do|fix|improve)|review\s+(my\s+)?(site|website)|any\s+suggestions?|how\s+can\s+i\s+improve)\b/i;

const BUSINESS_GOAL_PHRASE =
  /\b((want|need)\s+more\s+(catering\s+)?(orders?|customers?|leads?|calls?|bookings?|inquir(?:y|ies))|increase\s+(my\s+)?(catering\s+)?(orders?|sales|conversions?)|more\s+(calls?|leads?|bookings?|customers?)|more\s+people\s+to\s+call|need\s+more\s+leads)\b/i;

const STRUCTURAL_EDIT =
  /\b(add|insert|include|create|remove|delete|rewrite|make)\b/i;

const DESIGN_SIGNAL =
  /\b(outdated|modern|darker|lighter|luxury|premium|professional|elegant|minimal|bold|theme|color|colour|font|layout)\b/i;

const MIXED_IMAGE_AND_COPY = /\b(and|also|then)\b/i;

function clarificationQuestion(): string {
  return [
    "I can help with that.",
    "",
    "Before I make changes…",
    "",
    "Did you mean:",
    ...ATLAS_BRAIN_CLARIFICATION_OPTIONS.map((option) => `• ${option}`),
  ].join("\n");
}

function plan(
  goal: string,
  steps: AtlasExecutionPlan["steps"],
  impact: AtlasExecutionPlan["estimatedImpact"] = "medium",
): AtlasExecutionPlan {
  return { goal, steps, estimatedImpact: impact };
}

function decision(
  partial: AtlasBrainDecision,
): AtlasBrainDecision {
  return partial;
}

/**
 * Decide which specialists should participate — never mutates the project.
 */
export function decideAtlasBrain(input: AtlasBrainRouteInput): AtlasBrainDecision {
  const request = input.request.trim();
  const memoryPatch = inferMemoryFromMessage(request);
  const intentRoute = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });

  // --- Publish ---
  if (PUBLISH.test(request)) {
    return decision({
      intent: "publish",
      confidence: 0.92,
      selectedAgents: ["publisher"],
      needsClarification: false,
      executionPlan: plan("Publish the website", [
        {
          id: "publish.guide",
          agent: "publisher",
          label: "Guide the user to publish",
        },
      ], "high"),
      explanation:
        "When you’re ready to go live, use Publish in the top bar — I’ll keep the site ready for preview and production from here.",
      followUpSuggestions: [
        "Review the site for launch readiness",
        "Improve SEO before publishing",
        "Add subtle animations",
      ],
      memoryPatch,
    });
  }

  // --- Image-only ---
  if (isImageEditRequest(request) && !FEEL_DIRECTION.test(request)) {
    const alsoCopy =
      MIXED_IMAGE_AND_COPY.test(request) &&
      /\b(headline|cta|button|copy|text|faq|testimonial)/i.test(request);
    const agents: AtlasAgentId[] = alsoCopy
      ? ["image_agent", "editor_agent"]
      : ["image_agent"];
    return decision({
      intent: "image_edit",
      confidence: 0.94,
      selectedAgents: agents,
      needsClarification: false,
      executionPlan: plan(
        "Update imagery",
        agents.map((agent, index) => ({
          id: `image.step.${index}`,
          agent,
          label:
            agent === "image_agent"
              ? "Update images"
              : "Update matching copy",
        })),
        "high",
      ),
      explanation: "I’ll update the imagery to match what you asked for.",
      followUpSuggestions: [
        "Add matching images elsewhere",
        "Improve visual hierarchy",
        "Add subtle animations",
      ],
      memoryPatch,
    });
  }

  // --- Feel / luxury / direction → Creative Director + Editor (+ Image) ---
  if (FEEL_DIRECTION.test(request)) {
    const agents: AtlasAgentId[] = [
      "creative_director",
      "editor_agent",
      "image_agent",
    ];
    return decision({
      intent: "feel_direction",
      confidence: 0.88,
      selectedAgents: agents,
      needsClarification: false,
      executionPlan: plan(
        "Make the website feel more polished",
        [
          {
            id: "feel.cd",
            agent: "creative_director",
            label: "Identify polish opportunities",
          },
          {
            id: "feel.editor",
            agent: "editor_agent",
            label: "Apply design and content upgrades",
          },
          {
            id: "feel.image",
            agent: "image_agent",
            label: "Align imagery when possible",
          },
        ],
        "high",
      ),
      explanation:
        "I’ll elevate the overall feel — design, hierarchy, and visuals — so the site reads more intentional.",
      followUpSuggestions: [
        "Add matching images",
        "Add subtle animations",
        "Strengthen the call-to-action",
      ],
      memoryPatch: {
        ...memoryPatch,
        businessTone: memoryPatch.businessTone ?? "luxury",
      },
    });
  }

  // --- Business goal → Advisor + Creative + Editor ---
  // Never steal explicit content/design edits (e.g. FAQ answers that mention “call”).
  if (
    intentRoute.category === "business_goal" ||
    (BUSINESS_GOAL_PHRASE.test(request) &&
      intentRoute.category !== "explicit_content_edit" &&
      intentRoute.category !== "explicit_design_edit" &&
      intentRoute.category !== "mixed")
  ) {
    return decision({
      intent: "multi_goal",
      confidence: Math.max(intentRoute.confidence, 0.86),
      selectedAgents: [
        "business_advisor",
        "creative_director",
        "editor_agent",
      ],
      needsClarification: false,
      executionPlan: plan(
        request.length > 72 ? "Increase business results" : request,
        [
          {
            id: "goal.advisor",
            agent: "business_advisor",
            label: "Identify conversion opportunities",
          },
          {
            id: "goal.cd",
            agent: "creative_director",
            label: "Prioritize high-impact upgrades",
          },
          {
            id: "goal.editor",
            agent: "editor_agent",
            label: "Rewrite hero and strengthen CTA",
          },
          {
            id: "goal.proof",
            agent: "editor_agent",
            label: "Add social proof and contact visibility",
          },
        ],
        "high",
      ),
      explanation:
        "I’ll focus the site on that business goal — clearer message, stronger CTA, and proof that builds trust.",
      followUpSuggestions: [
        "Add a catering gallery",
        "Improve SEO",
        "Add testimonials",
      ],
      memoryPatch,
    });
  }

  // --- Recommend / review only ---
  if (RECOMMEND_ONLY.test(request) || intentRoute.category === "question") {
    return decision({
      intent: "recommend",
      confidence: 0.84,
      selectedAgents: ["creative_director", "business_advisor"],
      needsClarification: false,
      executionPlan: plan(
        "Review the website",
        [
          {
            id: "rec.cd",
            agent: "creative_director",
            label: "Review completeness",
          },
          {
            id: "rec.ba",
            agent: "business_advisor",
            label: "Surface opportunities",
          },
        ],
        "medium",
      ),
      explanation: "I’ll review the site and share the highest-impact opportunities.",
      followUpSuggestions: [
        "Apply the top improvement",
        "Complete my website",
        "Improve SEO",
      ],
      memoryPatch,
    });
  }

  // --- Ambiguous / unknown → clarify (only when there’s no clear edit verb) ---
  if (intentRoute.category === "clarification") {
    return decision({
      intent: "clarification",
      confidence: intentRoute.confidence,
      selectedAgents: ["intent_router"],
      needsClarification: true,
      clarificationQuestion: clarificationQuestion(),
      executionPlan: plan("Clarify the request", [], "low"),
      explanation: clarificationQuestion(),
      followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
      memoryPatch,
    });
  }

  if (
    intentRoute.category === "unknown" &&
    !intentRoute.signals.hasEditVerb &&
    !STRUCTURAL_EDIT.test(request) &&
    !DESIGN_SIGNAL.test(request) &&
    request.split(/\s+/).length <= 6
  ) {
    return decision({
      intent: "unknown",
      confidence: intentRoute.confidence,
      selectedAgents: ["intent_router"],
      needsClarification: true,
      clarificationQuestion: clarificationQuestion(),
      executionPlan: plan("Clarify the request", [], "low"),
      explanation: clarificationQuestion(),
      followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
      memoryPatch,
    });
  }

  // --- Explicit content / design / mixed → Editor (+ Image when mixed visuals) ---
  const wantsImage =
    isImageEditRequest(request) ||
    /\b(image|photo|picture|gallery|logo|hero\s+image)\b/i.test(request);
  const agents: AtlasAgentId[] =
    intentRoute.category === "mixed" && wantsImage
      ? ["editor_agent", "image_agent"]
      : intentRoute.category === "mixed"
        ? ["editor_agent", "creative_director"]
        : ["editor_agent"];

  return decision({
    intent: intentRoute.category,
    confidence: Math.max(intentRoute.confidence, 0.8),
    selectedAgents: agents,
    needsClarification: false,
    executionPlan: plan(
      "Apply your edit",
      agents.map((agent, index) => ({
        id: `edit.${index}`,
        agent,
        label:
          agent === "image_agent"
            ? "Update imagery"
            : agent === "creative_director"
              ? "Align design direction"
              : "Apply structured edits",
      })),
      "medium",
    ),
    explanation: "I’ll make those updates now.",
    followUpSuggestions: [
      "Add matching images",
      "Improve SEO",
      "Add subtle animations",
    ],
    memoryPatch,
  });
}

/**
 * Format an execution plan for the conversation (no agent names).
 */
export function formatExecutionPlanForUser(plan: AtlasExecutionPlan): string {
  if (!plan.steps.length) return "";
  const lines = [
    `Goal`,
    "",
    plan.goal,
    "",
    `Plan`,
    "",
    ...plan.steps.map((step) => `✓ ${step.label}`),
    "",
    `Estimated impact`,
    "",
    plan.estimatedImpact === "high"
      ? "High"
      : plan.estimatedImpact === "medium"
        ? "Medium"
        : "Low",
  ];
  return lines.join("\n");
}
