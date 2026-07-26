/**
 * Deterministic FNV-1a 32-bit hash → 8-char hex.
 * Stable across Node and browsers (no crypto async).
 */
export function fingerprintText(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint a sorted map of path → content. */
export function fingerprintFiles(
  files: Array<{ path: string; content: string }>,
): string {
  const normalized = [...files]
    .map((file) => ({ path: file.path, content: file.content }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\n${file.content}`)
    .join("\n/*---*/\n");
  return fingerprintText(normalized);
}
