/**
 * Atlas Brain Decision Engine (Sprint 26.2).
 * Ordered stages — continuation > explicit command > design > business > question > clarify.
 * Deterministic for the same project + conversation + memory + message.
 */

import {
  detectActionConfirmation,
  getActionMemory,
  hasActiveRecommendations,
  hasPendingClarification,
  shouldExecuteActionMemory,
} from "@/lib/ai/atlas-action-memory";
import { inferMemoryFromMessage } from "@/lib/ai/atlas-brain-memory";
import type {
  AtlasAgentId,
  AtlasBrainDecision,
  AtlasBrainIntent,
  AtlasExecutionPlan,
  AtlasProjectMemory,
} from "@/lib/ai/atlas-brain-types";
import { ATLAS_BRAIN_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-brain-types";
import {
  classifyCritiqueRequest,
  shouldOverridePendingClarification,
} from "@/lib/ai/critique-request";
import { detectPreferredLanguage } from "@/lib/ai/design-system-intelligence";
import { isImageEditRequest } from "@/lib/ai/image-agent";
import { routeIntent } from "@/lib/ai/intent-router";
import type { BusinessProject } from "@/types/business-project";

/** Pipeline stages in priority order (highest first). Sprint 28.1A order. */
export const DECISION_STAGES = [
  "continuation",
  "explicit_command",
  "critique",
  "explicit_design",
  "business_goal",
  "question",
  "clarification",
  "recommend",
] as const;

export type DecisionStage = (typeof DECISION_STAGES)[number];

/** Direct command categories that always beat business/memory reasoning. */
export const COMMAND_KINDS = [
  "seo",
  "accessibility",
  "performance",
  "animations",
  "icons",
  "images",
  "typography",
  "spacing",
  "readability",
  "branding",
  "navigation",
  "content",
  "publishing",
  "faq",
  "buttons",
  "general",
] as const;

export type CommandKind = (typeof COMMAND_KINDS)[number];

export type AtlasDecisionEngineInput = {
  request: string;
  project: BusinessProject;
  history?: Array<{ role: string; content: string }>;
};

export type AtlasDecisionEngineResult = {
  stage: DecisionStage;
  decision: AtlasBrainDecision;
  commandKind?: CommandKind;
};

/** Confidence bands (Sprint 26.2). */
export const CONFIDENCE_EXECUTE_IMMEDIATE = 0.95;
export const CONFIDENCE_EXECUTE_EXPLAIN = 0.75;
export const CONFIDENCE_CLARIFY = 0.5;

const FEEL_DIRECTION =
  /\b(feel|feeling|vibe|atmosphere)\s+(more\s+)?(luxurious|luxury|premium|elegant|modern|warm|friendly|bold|minimal|scandinavian|corporate|playful|editorial|industrial|medical)|(\b(look|looking)\s+(more\s+)?(luxurious|luxury|premium|elegant|expensive|modern|minimal)\b)|\bmore\s+(luxurious|luxury|premium|elegant)\b|\bluxur|\b(make\s+(it|this)\s+(more\s+)?(luxurious|luxury|premium|elegant|modern|minimal|friendly|corporate|playful|scandinavian))\b|\b(scandinavian|nordic|apple[- ]?like|design\s+language|boutique\s+feel|use\s+more\s+whitespace|more\s+whitespace)\b|\b(feels?\s+outdated|outdated|modernize|fresher\s+look)\b/i;

const BUSINESS_GOAL_PHRASE =
  /\b((want|need)\s+more\s+(catering\s+)?(orders?|customers?|leads?|calls?|bookings?|inquir(?:y|ies))|increase\s+(my\s+)?(catering\s+)?(orders?|sales|conversions?|bookings?|trust)|more\s+(calls?|leads?|bookings?|customers?)|more\s+people\s+to\s+call|need\s+more\s+leads|build\s+trust|get\s+more\s+catering)\b/i;

const AGENCY_REDESIGN_EXECUTE =
  /\b(redesign\s+(this|it|my\s+(homepage|site|website))|make\s+(this|it)\s+look\s+like\s+a\s+premium\s+agency|premium\s+agency\s+designed|make\s+all\s+of\s+(those|these)\s+improvements)\b/i;

const QUESTION_SHAPE =
  /^(who|what|why|how|when|where|which|can\s+you\s+explain|could\s+you\s+explain|should\s+i|is\s+it|are\s+there)\b|\?\s*$/i;

type CommandRule = {
  kind: CommandKind;
  pattern: RegExp;
  confidence: number;
  agents: AtlasAgentId[];
  intent: AtlasBrainIntent;
  goal: string;
  explanation: string;
  steps: AtlasExecutionPlan["steps"];
};

const COMMAND_RULES: CommandRule[] = [
  {
    kind: "seo",
    pattern:
      /\b(improve\s+seo|seo\b|search\s+engine|meta\s+description|site\s+title|social\s+preview)\b/i,
    confidence: 0.96,
    agents: ["editor_agent"],
    intent: "command_seo",
    goal: "Improve SEO",
    explanation: "I’ll tighten your SEO titles and descriptions so the site is clearer in search and previews.",
    steps: [
      { id: "cmd.seo", agent: "editor_agent", label: "Update SEO metadata" },
    ],
  },
  {
    kind: "animations",
    pattern:
      /\b(add\s+)?(subtle\s+)?(animations?|motion|scroll\s+animations?|micro[- ]?interactions?)\b/i,
    confidence: 0.96,
    agents: ["creative_director", "editor_agent"],
    intent: "command_animations",
    goal: "Add subtle animations",
    explanation: "I’ll add subtle motion so the page feels more polished without getting distracting.",
    steps: [
      { id: "cmd.motion", agent: "editor_agent", label: "Enable subtle animations" },
    ],
  },
  {
    kind: "icons",
    pattern: /\b(add\s+)?(service\s+)?icons?\b/i,
    confidence: 0.95,
    agents: ["creative_director", "editor_agent"],
    intent: "command_icons",
    goal: "Add icons",
    explanation: "I’ll add icons so services and key points are easier to scan.",
    steps: [
      { id: "cmd.icons", agent: "editor_agent", label: "Enable service icons" },
    ],
  },
  {
    kind: "readability",
    pattern:
      /\b(easier\s+to\s+read|hard\s+to\s+read|readability|readable|make\s+the\s+words|simpler\s+copy|clearer\s+(copy|text|words)|too\s+dense|cluttered|crowded)\b/i,
    confidence: 0.95,
    agents: ["editor_agent"],
    intent: "command_readability",
    goal: "Improve readability",
    explanation:
      "I’ll improve readability — clearer type hierarchy, more breathing room, stronger contrast, and simpler wording where it helps.",
    steps: [
      {
        id: "cmd.read",
        agent: "editor_agent",
        label: "Improve typography, spacing, contrast, and copy clarity",
      },
    ],
  },
  {
    kind: "spacing",
    pattern:
      /\b(more\s+whitespace|more\s+space|breathing\s+room|airy|less\s+cramped|increase\s+spacing)\b/i,
    confidence: 0.94,
    agents: ["editor_agent", "creative_director"],
    intent: "command_spacing",
    goal: "Improve spacing",
    explanation: "I’ll open up the layout with more whitespace so sections feel calmer and easier to scan.",
    steps: [
      { id: "cmd.space", agent: "editor_agent", label: "Increase spacing and site width balance" },
    ],
  },
  {
    kind: "typography",
    pattern:
      /\b(typography|font\s*size|fonts?|headings?\s+hierarchy|line\s+height|typeface)\b/i,
    confidence: 0.93,
    agents: ["editor_agent"],
    intent: "command_typography",
    goal: "Update typography",
    explanation: "I’ll refine the typography so headings and body text feel clearer and more intentional.",
    steps: [
      { id: "cmd.type", agent: "editor_agent", label: "Update typography" },
    ],
  },
  {
    kind: "accessibility",
    pattern: /\b(accessibility|a11y|wcag|contrast|hard\s+to\s+see)\b/i,
    confidence: 0.94,
    agents: ["editor_agent"],
    intent: "command_accessibility",
    goal: "Improve accessibility",
    explanation: "I’ll improve contrast and clarity so the site is easier for everyone to use.",
    steps: [
      { id: "cmd.a11y", agent: "editor_agent", label: "Improve contrast and clarity" },
    ],
  },
  {
    kind: "performance",
    pattern: /\b(performance|faster|speed\s+up|load\s+faster|optimize\s+performance)\b/i,
    confidence: 0.9,
    agents: ["editor_agent"],
    intent: "command_performance",
    goal: "Improve performance cues",
    explanation:
      "I’ll keep the layout lean and avoid heavy polish that could slow the experience — tell me if you want a deeper performance pass next.",
    steps: [
      { id: "cmd.perf", agent: "editor_agent", label: "Apply light performance-minded polish" },
    ],
  },
  {
    kind: "images",
    pattern:
      /\b(replace|change|swap|update|add|set)\b[\s\S]{0,40}\b(hero\s+images?|logo|gallery|photos?|pictures?|images?)\b|\b(hero\s+images?|logo|gallery\s+images?|matching\s+images?)\b/i,
    confidence: 0.96,
    agents: ["image_agent"],
    intent: "image_edit",
    goal: "Update imagery",
    explanation: "I’ll update the imagery to match what you asked for.",
    steps: [
      { id: "cmd.image", agent: "image_agent", label: "Update images" },
    ],
  },
  {
    kind: "buttons",
    pattern:
      /\b(buttons?\s+(round|rounded|pill|square)|make\s+the\s+buttons?\s+(round|rounded|pill|square)|button\s+style)\b/i,
    confidence: 0.96,
    agents: ["editor_agent"],
    intent: "command_buttons",
    goal: "Update button style",
    explanation: "I’ll update the button style to match what you asked for.",
    steps: [
      { id: "cmd.btn", agent: "editor_agent", label: "Update button style" },
    ],
  },
  {
    kind: "faq",
    pattern:
      /\b(update|change|replace|rewrite|edit|add|fix|insert)\b[\s\S]{0,80}\b(faq|answer|question)\b/i,
    confidence: 0.95,
    agents: ["editor_agent"],
    intent: "explicit_content_edit",
    goal: "Update FAQ / content",
    explanation: "I’ll update that content now.",
    steps: [
      { id: "cmd.faq", agent: "editor_agent", label: "Update FAQ or page copy" },
    ],
  },
  {
    kind: "navigation",
    pattern: /\b(navigation|nav\s+links|menu\s+labels|shorten\s+(the\s+)?nav)\b/i,
    confidence: 0.93,
    agents: ["editor_agent"],
    intent: "command_navigation",
    goal: "Update navigation",
    explanation: "I’ll tighten the navigation so it’s easier to scan.",
    steps: [
      { id: "cmd.nav", agent: "editor_agent", label: "Update navigation" },
    ],
  },
  {
    kind: "branding",
    pattern:
      /\b(branding|brand\s+colors?|brand\s+identity)\b|\b(change|update|set|make)\b[\s\S]{0,100}\b(theme|colors?|colours?|navy|gold|accents?|primary\s+color|accent\s+color)\b|\b(dark\s+navy|gold\s+accents?)\b/i,
    confidence: 0.95,
    agents: ["editor_agent"],
    intent: "explicit_design_edit",
    goal: "Update theme colors",
    explanation: "I’ll update the theme colors now.",
    steps: [
      { id: "cmd.brand", agent: "editor_agent", label: "Apply theme and color updates" },
    ],
  },
  {
    kind: "publishing",
    pattern:
      /\b(publish|go\s+live|make\s+(it\s+)?live|deploy(\s+my\s+site)?|launch\s+(my\s+)?(site|website))\b/i,
    confidence: 0.97,
    agents: ["publisher"],
    intent: "publish",
    goal: "Publish the website",
    explanation:
      "When you’re ready to go live, use Publish in the top bar — I’ll keep the site ready for preview and production from here.",
    steps: [
      { id: "cmd.publish", agent: "publisher", label: "Guide the user to publish" },
    ],
  },
  {
    kind: "content",
    pattern:
      /\b(rewrite|update|change|fix|edit)\b[\s\S]{0,40}\b(headline|subheadline|hero|about|services?|cta|copy|text|wording)\b|\b(rewrite\s+everything|rewrite\s+the\s+whole|overhaul\s+copy|rewrite\s+.+\s+for\s+a\b)\b/i,
    confidence: 0.94,
    agents: ["editor_agent"],
    intent: "explicit_content_edit",
    goal: "Update content",
    explanation: "I’ll update that copy now.",
    steps: [
      { id: "cmd.content", agent: "editor_agent", label: "Apply content edits" },
    ],
  },
];

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

function withConfidencePolicy(
  decision: AtlasBrainDecision,
): AtlasBrainDecision {
  const c = decision.confidence;
  if (c >= CONFIDENCE_EXECUTE_EXPLAIN) {
    return { ...decision, needsClarification: false };
  }
  if (c >= CONFIDENCE_CLARIFY) {
    return {
      ...decision,
      needsClarification: true,
      clarificationQuestion:
        decision.clarificationQuestion || clarificationQuestion(),
      explanation: decision.clarificationQuestion || clarificationQuestion(),
      selectedAgents: ["intent_router"],
      followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
    };
  }
  return {
    ...decision,
    needsClarification: true,
    clarificationQuestion:
      decision.clarificationQuestion ||
      "I’m not sure what to change yet — tell me a bit more about the outcome you want.",
    explanation:
      decision.explanation ||
      "I’m not fully sure what you need yet. Share a bit more detail and I’ll take it from there.",
    selectedAgents: ["intent_router"],
    followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
  };
}

function matchCommand(request: string): CommandRule | null {
  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(request)) return rule;
  }
  return null;
}

/**
 * Stage 1 — Continue existing conversation (Action Memory).
 */
export function stageContinuation(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const memory = getActionMemory(input.project);
  // Latest critique/redesign asks always beat sticky clarification memory.
  if (shouldOverridePendingClarification(input.request)) {
    return null;
  }
  if (!shouldExecuteActionMemory(input.request, memory)) return null;
  if (!hasPendingClarification(memory) && !hasActiveRecommendations(memory)) {
    return null;
  }

  const confirmation = detectActionConfirmation(input.request);
  return {
    stage: "continuation",
    decision: withConfidencePolicy({
      intent: "continue_plan",
      confidence: 0.99,
      selectedAgents: ["creative_director", "editor_agent"],
      needsClarification: false,
      executionPlan: memory.executionPlan ?? plan("Continue the active plan", [
        {
          id: "cont.apply",
          agent: "creative_director",
          label: "Apply the pending improvements",
        },
      ], "high"),
      explanation: "I’ll continue with the plan we already lined up.",
      followUpSuggestions: [
        "Add matching images",
        "Improve SEO",
        "Add subtle animations",
      ],
      memoryPatch: inferMemoryFromMessage(input.request),
      decisionStage: "continuation",
      commandKind:
        confirmation.kind === "kind_filter" ? "general" : undefined,
    }),
  };
}

/**
 * Stage 2 — Explicit commands (SEO, animations, readability, …).
 */
export function stageExplicitCommand(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const request = input.request.trim();

  // Image agent short-circuit when clearly image-only and not a feel request
  if (isImageEditRequest(request) && !FEEL_DIRECTION.test(request)) {
    const alsoCopy =
      /\b(and|also|then)\b/i.test(request) &&
      /\b(headline|cta|button|copy|text|faq|testimonial)\b/i.test(request);
    const agents: AtlasAgentId[] = alsoCopy
      ? ["image_agent", "editor_agent"]
      : ["image_agent"];
    return {
      stage: "explicit_command",
      commandKind: "images",
      decision: withConfidencePolicy({
        intent: "image_edit",
        confidence: 0.96,
        selectedAgents: agents,
        needsClarification: false,
        executionPlan: plan(
          "Update imagery",
          agents.map((agent, index) => ({
            id: `image.${index}`,
            agent,
            label:
              agent === "image_agent" ? "Update images" : "Update matching copy",
          })),
          "high",
        ),
        explanation: "I’ll update the imagery to match what you asked for.",
        followUpSuggestions: (() => {
          const hasMedia = (input.project.mediaLibrary ?? []).some(
            (asset) => !asset.unavailable,
          );
          return hasMedia
            ? [
                "Add matching images elsewhere",
                "Improve visual hierarchy",
                "Add subtle animations",
              ]
            : [
                "Improve visual hierarchy",
                "Add subtle animations",
                "Improve SEO",
              ];
        })(),
        memoryPatch: inferMemoryFromMessage(request),
        decisionStage: "explicit_command",
        commandKind: "images",
      }),
    };
  }

  const rule = matchCommand(request);
  if (!rule) return null;

  // Publishing is guidance-only
  if (rule.kind === "publishing") {
    return {
      stage: "explicit_command",
      commandKind: rule.kind,
      decision: withConfidencePolicy({
        intent: "publish",
        confidence: rule.confidence,
        selectedAgents: rule.agents,
        needsClarification: false,
        executionPlan: plan(rule.goal, rule.steps, "high"),
        explanation: rule.explanation,
        followUpSuggestions: [
          "Review the site for launch readiness",
          "Improve SEO before publishing",
          "Add subtle animations",
        ],
        memoryPatch: inferMemoryFromMessage(request),
        decisionStage: "explicit_command",
        commandKind: rule.kind,
      }),
    };
  }

  return {
    stage: "explicit_command",
    commandKind: rule.kind,
    decision: withConfidencePolicy({
      intent: rule.intent,
      confidence: rule.confidence,
      selectedAgents: rule.agents,
      needsClarification: false,
      executionPlan: plan(rule.goal, rule.steps, "high"),
      explanation: rule.explanation,
      followUpSuggestions: [
        "Add matching images",
        "Improve SEO",
        "Add subtle animations",
      ].filter((s) => !s.toLowerCase().includes(rule.kind.slice(0, 3))),
      memoryPatch: inferMemoryFromMessage(request),
      decisionStage: "explicit_command",
      commandKind: rule.kind,
    }),
  };
}

/**
 * Stage 3 — Explicit critique / review (before design transforms & business goals).
 */
export function stageCritique(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const request = input.request.trim();
  const classified = classifyCritiqueRequest(request);
  if (classified.kind === "none" || !classified.intent) return null;

  const isExecute = classified.kind === "execute";
  return {
    stage: "critique",
    decision: withConfidencePolicy({
      intent: classified.intent,
      confidence: classified.confidence,
      selectedAgents: isExecute
        ? ["creative_director", "editor_agent", "image_agent"]
        : ["creative_director", "business_advisor"],
      needsClarification: false,
      executionPlan: plan(
        isExecute
          ? "Execute a coordinated premium redesign"
          : "Review the website",
        isExecute
          ? [
              {
                id: "critique.pipeline",
                agent: "creative_director",
                label: "Plan coordinated redesign via critique pipeline",
              },
              {
                id: "critique.apply",
                agent: "editor_agent",
                label: "Apply coordinated improvements",
              },
            ]
          : [
              {
                id: "critique.pipeline",
                agent: "creative_director",
                label: "Run unified design critique",
              },
            ],
        "high",
      ),
      explanation: isExecute
        ? "I’ll critique the homepage, then apply a coordinated redesign plan."
        : "I’ll review the site and share the highest-impact opportunities — without changing anything yet.",
      followUpSuggestions: isExecute
        ? ["Apply All", "Add matching images", "Improve SEO"]
        : ["Apply All", "Complete my website", "Improve SEO"],
      memoryPatch: inferMemoryFromMessage(request),
      decisionStage: "critique",
      selectedPath: classified.selectedPath ?? undefined,
      shouldExecuteEdits: classified.shouldExecuteEdits,
      matchedSignals: classified.matchedSignals,
    }),
  };
}

/**
 * Stage 4 — Explicit design / feel requests.
 */
export function stageExplicitDesign(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const request = input.request.trim();
  const preferred = detectPreferredLanguage(request);
  const intentRoute = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });
  const critiqueClassified = classifyCritiqueRequest(request);

  // Imperative redesign only — “how would you redesign…?” is critique.
  const wantsRedesignExecute =
    critiqueClassified.kind === "execute" ||
    (AGENCY_REDESIGN_EXECUTE.test(request) &&
      !/\b(how|what)\s+would\s+you\b/i.test(request) &&
      critiqueClassified.kind !== "critique");

  // Critique stage owns advisory redesign / agency hypotheticals.
  if (critiqueClassified.kind === "critique") {
    return null;
  }

  // Don't steal pure business goals (e.g. “more catering orders” must not
  // become a restaurant design-language pick via industry aliases).
  if (
    BUSINESS_GOAL_PHRASE.test(request) &&
    !FEEL_DIRECTION.test(request) &&
    !wantsRedesignExecute
  ) {
    return null;
  }

  const wantsFeel =
    wantsRedesignExecute ||
    FEEL_DIRECTION.test(request) ||
    (Boolean(preferred) &&
      /\b(style|styling|design\s+language|look|feel|aesthetic|make\s+it)\b/i.test(
        request,
      ));

  // Concrete design edits (colors, theme, fonts, buttons) → editor only.
  // Do not run Design System / Creative Director over a named-color change.
  // Also catch “mixed” when wording-preservation language tripped content signals.
  if (
    (intentRoute.category === "explicit_design_edit" ||
      (intentRoute.category === "mixed" &&
        intentRoute.signals.hasDesignTarget)) &&
    !wantsFeel
  ) {
    return {
      stage: "explicit_command",
      commandKind: "branding",
      decision: withConfidencePolicy({
        intent: "explicit_design_edit",
        confidence: Math.max(intentRoute.confidence, 0.92),
        selectedAgents: ["editor_agent"],
        needsClarification: false,
        executionPlan: plan(
          "Apply design edits",
          [
            {
              id: "design.editor",
              agent: "editor_agent",
              label: "Apply structured design edits",
            },
          ],
          "high",
        ),
        explanation: "I’ll apply those design updates now.",
        followUpSuggestions: [
          "Add subtle animations",
          "Improve SEO",
          "Make it feel more luxurious",
        ],
        memoryPatch: inferMemoryFromMessage(request),
        decisionStage: "explicit_command",
        commandKind: "branding",
      }),
    };
  }

  if (!wantsFeel && intentRoute.category !== "explicit_design_edit") {
    return null;
  }

  if (!wantsFeel) {
    return null;
  }

  const agents: AtlasAgentId[] = [
    "creative_director",
    "editor_agent",
    "image_agent",
  ];
  const memoryPatch: Partial<AtlasProjectMemory> = {
    ...inferMemoryFromMessage(request),
  };
  if (preferred) {
    memoryPatch.businessTone = preferred;
  }

  return {
    stage: "explicit_design",
    decision: withConfidencePolicy({
      intent: "feel_direction",
      confidence: wantsRedesignExecute ? 0.95 : preferred ? 0.93 : 0.88,
      selectedAgents: agents,
      needsClarification: false,
      executionPlan: plan(
        wantsRedesignExecute
          ? "Execute a coordinated premium redesign"
          : "Elevate the design direction",
        [
          {
            id: "design.critique",
            agent: "creative_director",
            label: wantsRedesignExecute
              ? "Plan coordinated redesign"
              : "Choose a design language",
          },
          {
            id: "design.cd",
            agent: "creative_director",
            label: "Identify polish opportunities",
          },
          {
            id: "design.editor",
            agent: "editor_agent",
            label: "Apply design and content upgrades",
          },
          {
            id: "design.image",
            agent: "image_agent",
            label: "Align imagery when possible",
          },
        ],
        "high",
      ),
      explanation: wantsRedesignExecute
        ? "I’ll plan a coordinated premium redesign — typography, spacing, hierarchy, imagery, and CTA — then apply it."
        : "I’ll elevate the overall feel — design language, hierarchy, and visuals — so the site reads more intentional.",
      followUpSuggestions: [
        "Add matching images",
        "Add subtle animations",
        "Strengthen the call-to-action",
      ],
      memoryPatch,
      decisionStage: "explicit_design",
    }),
  };
}

/**
 * Stage 5 — Business goals.
 */
export function stageBusinessGoal(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const request = input.request.trim();
  // Latest critique request always beats stored business goals / memory.
  if (classifyCritiqueRequest(request).kind !== "none") return null;

  const intentRoute = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });

  const isGoal =
    intentRoute.category === "business_goal" ||
    (BUSINESS_GOAL_PHRASE.test(request) &&
      intentRoute.category !== "explicit_content_edit" &&
      intentRoute.category !== "explicit_design_edit" &&
      intentRoute.category !== "mixed");

  if (!isGoal) return null;

  return {
    stage: "business_goal",
    decision: withConfidencePolicy({
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
      memoryPatch: inferMemoryFromMessage(request),
      decisionStage: "business_goal",
    }),
  };
}

/**
 * Stage 6 — Informational questions (never execute edits; critique handled earlier).
 */
export function stageQuestion(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult | null {
  const request = input.request.trim();
  if (classifyCritiqueRequest(request).kind !== "none") return null;

  const intentRoute = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });

  const isQuestion =
    intentRoute.category === "question" ||
    (QUESTION_SHAPE.test(request) && !matchCommand(request));

  if (!isQuestion) return null;

  return {
    stage: "question",
    decision: withConfidencePolicy({
      intent: "question",
      confidence: 0.85,
      selectedAgents: ["creative_director", "business_advisor"],
      needsClarification: false,
      executionPlan: plan("Answer the question", [
        {
          id: "q.cd",
          agent: "creative_director",
          label: "Explain design choices",
        },
        {
          id: "q.ba",
          agent: "business_advisor",
          label: "Surface opportunities",
        },
      ], "medium"),
      explanation:
        "I’ll explain the current design choices and what I’d improve — without changing the site yet.",
      followUpSuggestions: [
        "Review my website",
        "Complete my website",
        "Improve SEO",
      ],
      memoryPatch: inferMemoryFromMessage(request),
      decisionStage: "question",
    }),
  };
}

/**
 * Stage 7 — Clarification (once; never loops — Action Memory stores pending).
 */
export function stageClarification(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult {
  const request = input.request.trim();
  // Never clarify clear critique / redesign asks.
  const critique = classifyCritiqueRequest(request);
  if (critique.kind !== "none" && critique.intent) {
    return {
      stage: "critique",
      decision: withConfidencePolicy({
        intent: critique.intent,
        confidence: critique.confidence,
        selectedAgents: ["creative_director"],
        needsClarification: false,
        executionPlan: plan("Review the website", [
          {
            id: "critique.pipeline",
            agent: "creative_director",
            label: "Run unified design critique",
          },
        ], "high"),
        explanation:
          "I’ll review the site and share the highest-impact opportunities.",
        followUpSuggestions: ["Apply All", "Complete my website", "Improve SEO"],
        memoryPatch: inferMemoryFromMessage(request),
        decisionStage: "critique",
        selectedPath: critique.selectedPath ?? undefined,
        shouldExecuteEdits: critique.shouldExecuteEdits,
        matchedSignals: critique.matchedSignals,
      }),
    };
  }

  const intentRoute = routeIntent({
    request,
    project: input.project,
    history: input.history,
  });

  const confidence =
    intentRoute.category === "clarification"
      ? Math.max(intentRoute.confidence, 0.55)
      : Math.min(intentRoute.confidence, 0.45);

  return {
    stage: "clarification",
    decision: withConfidencePolicy({
      intent:
        intentRoute.category === "clarification" ? "clarification" : "unknown",
      confidence,
      selectedAgents: ["intent_router"],
      needsClarification: true,
      clarificationQuestion: clarificationQuestion(),
      executionPlan: plan("Clarify the request", [], "low"),
      explanation: clarificationQuestion(),
      followUpSuggestions: [...ATLAS_BRAIN_CLARIFICATION_OPTIONS],
      memoryPatch: inferMemoryFromMessage(request),
      decisionStage: "clarification",
    }),
  };
}

/**
 * Run the full decision pipeline in priority order (Sprint 28.1A).
 * continuation → explicit command → critique → design → business → question → clarify
 */
export function decideWithAtlasBrainEngine(
  input: AtlasDecisionEngineInput,
): AtlasDecisionEngineResult {
  const request = input.request?.trim() ?? "";
  if (!request) {
    return stageClarification({ ...input, request: "" });
  }

  return (
    stageContinuation(input) ??
    stageExplicitCommand(input) ??
    stageCritique(input) ??
    stageExplicitDesign(input) ??
    stageBusinessGoal(input) ??
    stageQuestion(input) ??
    stageClarification(input)
  );
}

/**
 * Natural preference line — never dump raw memory key/value pairs.
 */
export function formatNaturalPreferenceNote(
  memory: AtlasProjectMemory | null | undefined,
): string {
  if (!memory) return "";
  const bits: string[] = [];
  if (memory.businessTone) {
    bits.push(`the ${memory.businessTone} tone we've been building`);
  }
  if (memory.preferredLayouts?.[0]) {
    bits.push(`a ${memory.preferredLayouts[0]} layout direction`);
  }
  if (memory.preferredThemes?.[0]) {
    bits.push(`a ${memory.preferredThemes[0]} theme`);
  }
  if (!bits.length) return "";
  if (bits.length === 1) {
    return `I kept ${bits[0]} while making these updates.`;
  }
  if (bits.length === 2) {
    return `I kept ${bits[0]} and ${bits[1]} while making these updates.`;
  }
  return `I kept ${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]} while making these updates.`;
}
