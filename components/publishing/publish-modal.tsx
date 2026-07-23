"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import {
  buildPublishedSitePath,
  publisher,
} from "@/lib/publishing";
import {
  PUBLISH_STEPS,
  type PublishStepId,
} from "@/types/publishing";

type PublishPhase = "idle" | "publishing" | "success" | "error";

type PublishModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Mock publish flow — progress pipeline + success with Visit / Copy / Publish Again.
 * All deploy work goes through `lib/publishing` (WebsitePublisher).
 */
export default function PublishModal({ open, onClose }: PublishModalProps) {
  const { project, updateProject } = useProject();
  const [phase, setPhase] = useState<PublishPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState<PublishStepId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<PublishStepId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const runIdRef = useRef(0);

  const publishedUrl = project.publish?.url ?? null;
  const publishedSlug = project.publish?.slug ?? null;

  useEffect(() => {
    if (!open) {
      runIdRef.current += 1;
      setPhase("idle");
      setProgress(0);
      setActiveStep(null);
      setCompletedSteps([]);
      setError(null);
      setCopied(false);
      return;
    }

    // Auto-start publish when the modal opens.
    void startPublish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function startPublish() {
    const runId = ++runIdRef.current;
    setPhase("publishing");
    setProgress(0);
    setActiveStep(null);
    setCompletedSteps([]);
    setError(null);
    setCopied(false);

    try {
      const result = await publisher.publish(project, (event) => {
        if (runId !== runIdRef.current) return;

        const stepIndex = PUBLISH_STEPS.findIndex(
          (step) => step.id === event.step,
        );
        const stepCompleteProgress = Math.round(
          ((stepIndex + 1) / PUBLISH_STEPS.length) * 100,
        );

        setActiveStep(event.step);
        setProgress(event.progress);
        setCompletedSteps(
          PUBLISH_STEPS.slice(
            0,
            event.progress >= stepCompleteProgress ? stepIndex + 1 : stepIndex,
          ).map((step) => step.id),
        );
      });

      if (runId !== runIdRef.current) return;

      updateProject({
        status: "published",
        publish: result,
      });
      setProgress(100);
      setCompletedSteps(PUBLISH_STEPS.map((step) => step.id));
      setActiveStep(null);
      setPhase("success");
    } catch {
      if (runId !== runIdRef.current) return;
      setError("Publish failed. Please try again.");
      setPhase("error");
    }
  }

  async function handleCopyLink() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close publish dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2
              id="publish-title"
              className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground"
            >
              Publish Website
            </h2>
            <p className="text-xs text-muted">Mock deploy · no real hosting yet</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {phase === "publishing" || phase === "idle" ? (
            <>
              <ul className="space-y-3" aria-live="polite">
                {PUBLISH_STEPS.map((step) => {
                  const done = completedSteps.includes(step.id);
                  const current = activeStep === step.id && !done;
                  return (
                    <li
                      key={step.id}
                      className={`flex items-center gap-3 text-sm transition-colors ${
                        done
                          ? "text-foreground"
                          : current
                            ? "text-accent"
                            : "text-muted"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                          done
                            ? "border-accent bg-accent-soft text-accent"
                            : current
                              ? "border-accent"
                              : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {done ? "✓" : current ? "…" : ""}
                      </span>
                      {step.label}
                    </li>
                  );
                })}
              </ul>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-background"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </>
          ) : null}

          {phase === "success" && publishedUrl ? (
            <div className="space-y-4 text-center">
              <p className="text-lg font-semibold text-foreground">
                ✅ Website Published Successfully
              </p>
              <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
                <p className="text-xs text-muted">Your live site</p>
                <p className="mt-1 break-all font-mono text-sm text-accent">
                  {publishedUrl}
                </p>
              </div>
              <p className="text-xs text-muted">
                Open Visit Website for a read-only preview built from your
                content, images, branding, and template.
              </p>
            </div>
          ) : null}

          {phase === "error" ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {phase === "success" && publishedSlug && publishedUrl ? (
            <>
              <Button
                href={buildPublishedSitePath(publishedSlug)}
                className="w-full"
              >
                Visit Website
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleCopyLink}
              >
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void startPublish()}
              >
                Publish Again
              </Button>
            </>
          ) : null}

          {phase === "error" ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => void startPublish()}
            >
              Try Again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
