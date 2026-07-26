/**
 * Next.js server instrumentation — validate public Atlas origin on boot.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateAppUrlAtStartup } = await import("@/lib/app-url");
  validateAppUrlAtStartup();
}
