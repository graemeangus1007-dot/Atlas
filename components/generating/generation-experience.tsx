"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GenerationProgressBar from "@/components/generating/generation-progress-bar";
import GenerationStepsList from "@/components/generating/generation-steps-list";
import { useProject } from "@/context/project-context";
import {
  GENERATION_DURATION_MS,
  GENERATION_STEP_INTERVAL_MS,
  GENERATION_STEPS,
} from "@/data/generation-steps";

/**
 * Simulated generation flow driven by the central BusinessProject.
 * Marks status generating → ready, then routes to /preview.
 */
export default function GenerationExperience() {
  const router = useRouter();
  const { project, updateProject } = useProject();
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    updateProject({ status: "generating" });
  }, [updateProject]);

  useEffect(() => {
    const startedAt = performance.now();
    let frameId = 0;
    let hasNavigated = false;
    let navigateTimeout: number | undefined;

    function tick(now: number) {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(100, (elapsed / GENERATION_DURATION_MS) * 100);
      const nextCompleted = Math.min(
        GENERATION_STEPS.length,
        Math.floor(elapsed / GENERATION_STEP_INTERVAL_MS),
      );

      setProgress(nextProgress);
      setCompletedCount(nextCompleted);

      if (nextProgress >= 100 && !hasNavigated) {
        hasNavigated = true;
        updateProject({ status: "ready" });
        navigateTimeout = window.setTimeout(() => {
          router.push("/preview");
        }, 400);
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (navigateTimeout) window.clearTimeout(navigateTimeout);
    };
  }, [router, updateProject]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/4 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,184,168,0.16)_0%,transparent_65%)] blur-3xl atlas-breathe" />
        <div className="absolute bottom-0 left-1/2 h-px w-[min(100%,36rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      </div>

      <header className="px-5 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <Link
            href="/"
            className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-accent-hover"
          >
            Atlas
          </Link>
          <span className="truncate text-sm text-muted">
            {project.businessName}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-8 sm:py-16">
        <div className="w-full max-w-xl animate-fade-up">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            Almost there
          </p>

          <h1 className="mt-3 font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Generating Your Website...
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Atlas is designing {project.businessName} using AI.
          </p>

          <div className="mt-10">
            <GenerationProgressBar progress={progress} />
          </div>

          <GenerationStepsList completedCount={completedCount} />
        </div>
      </main>
    </div>
  );
}
