/**
 * Next.js server instrumentation — validate environment on boot.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateAppUrlAtStartup } = await import("@/lib/app-url");
  const { validateEnvAtStartup } = await import("@/lib/env/server");

  validateEnvAtStartup();
  validateAppUrlAtStartup();
}
