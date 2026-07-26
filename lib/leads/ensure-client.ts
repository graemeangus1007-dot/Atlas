/**
 * Ensure the project's lead form exists and sync success message before publish.
 * Returns the form id (or null if ensure fails / no project).
 */
export async function ensureProjectLeadForm(input: {
  projectId: string | null | undefined;
  successMessage?: string;
  description?: string;
}): Promise<string | null> {
  if (!input.projectId) return null;
  try {
    const res = await fetch("/api/forms/ensure", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: input.projectId,
        successMessage: input.successMessage,
        description: input.description,
        name: "Contact form",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { form?: { id?: string } };
    return data.form?.id?.trim() || null;
  } catch {
    return null;
  }
}
