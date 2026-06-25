// Block types emitted by the copilot edge function.
// The client zod (Task 1) mirrors these shapes; keep both in sync.

export type Block =
  | { kind: "text"; text: string }
  | { kind: "widget"; source: string }
  | { kind: "action"; tool: string; args: Record<string, unknown>; text: string }

/**
 * Validates the raw object returned by the model and produces a typed Block array.
 * Any block that fails shape/allowlist checks is silently dropped (defense-in-depth;
 * the primary safety net is client-side zod validation from Task 1).
 */
export function validateBlocks(
  parsed: unknown,
  allow: { sources: string[]; tools: string[] },
): Block[] {
  const arr = (parsed as { blocks?: unknown })?.blocks
  if (!Array.isArray(arr)) return []

  const out: Block[] = []
  for (const b of arr) {
    if (!b || typeof b !== "object") continue
    const kind = (b as { kind?: unknown }).kind

    if (
      kind === "text" &&
      typeof (b as { text?: unknown }).text === "string" &&
      (b as { text: string }).text.trim()
    ) {
      out.push({ kind: "text", text: (b as { text: string }).text })
    } else if (
      kind === "widget" &&
      allow.sources.includes((b as { source?: unknown }).source as string)
    ) {
      out.push({ kind: "widget", source: (b as { source: string }).source })
    } else if (
      kind === "action" &&
      allow.tools.includes((b as { tool?: unknown }).tool as string)
    ) {
      const a = b as { tool: string; args?: unknown; text?: unknown }
      out.push({
        kind: "action",
        tool: a.tool,
        args:
          a.args && typeof a.args === "object"
            ? (a.args as Record<string, unknown>)
            : {},
        text:
          typeof a.text === "string" && a.text.trim() ? a.text : "Confirm?",
      })
    }
  }
  return out
}
