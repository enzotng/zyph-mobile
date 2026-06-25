// Block types emitted by the copilot edge function.
// The client zod (Task 1) mirrors these shapes; keep both in sync.

export type Chip =
  | { action: "navigate"; to: string; label: string }
  | { action: "prompt"; prompt: string; label: string }
  | { action: "tool"; tool: string; args: Record<string, unknown>; label: string }

export type Block =
  | { kind: "text"; text: string }
  | { kind: "widget"; source: string }
  | { kind: "action"; tool: string; args: Record<string, unknown>; text: string }
  | { kind: "chips"; chips: Chip[] }

/**
 * Validates the raw object returned by the model and produces a typed Block array.
 * Any block that fails shape/allowlist checks is silently dropped (defense-in-depth;
 * the primary safety net is client-side zod validation from Task 1).
 */
export function validateBlocks(
  parsed: unknown,
  allow: { sources: string[]; tools: string[]; navTargets: string[] },
  language: "en" | "fr" = "en",
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
          typeof a.text === "string" && a.text.trim()
            ? a.text
            : language === "fr"
              ? "Je confirme ?"
              : "Confirm?",
      })
    } else if (kind === "chips") {
      const rawChips = (b as { chips?: unknown }).chips
      if (!Array.isArray(rawChips) || rawChips.length === 0) continue

      const validChips: Chip[] = []
      for (const c of rawChips) {
        if (!c || typeof c !== "object") continue
        const action = (c as { action?: unknown }).action
        const label = (c as { label?: unknown }).label
        if (typeof label !== "string" || !label.trim()) continue

        if (action === "navigate") {
          const to = (c as { to?: unknown }).to
          if (typeof to === "string" && to.trim() && allow.navTargets.includes(to)) {
            validChips.push({ action: "navigate", to, label })
          }
        } else if (action === "prompt") {
          const prompt = (c as { prompt?: unknown }).prompt
          if (typeof prompt === "string" && prompt.trim()) {
            validChips.push({ action: "prompt", prompt, label })
          }
        } else if (action === "tool") {
          const tool = (c as { tool?: unknown }).tool
          if (typeof tool === "string" && tool.trim() && allow.tools.includes(tool)) {
            const rawArgs = (c as { args?: unknown }).args
            const args =
              rawArgs && typeof rawArgs === "object"
                ? (rawArgs as Record<string, unknown>)
                : {}
            validChips.push({ action: "tool", tool, args, label })
          }
        }
      }

      if (validChips.length > 0) {
        out.push({ kind: "chips", chips: validChips.slice(0, 3) })
      }
    }
  }
  return out
}
