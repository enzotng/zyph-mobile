// One shared categorical palette for "identity" tints (avatars, fallback covers, per-day routes).
// Distinct hues that deliberately avoid the reserved money green/red so a categorical swatch can
// never read as a balance. Brand accent indigo leads; sky, violet, amber, pink, teal, orange,
// cyan follow.
export const CATEGORICAL_TINTS = [
  '#4F46E5', // indigo (brand accent)
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EC4899', // pink
  '#0D9488', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
] as const

// Build an rgba() string from a hex color + alpha (0-1). Used for "soft" token
// fills - a translucent tint of a theme color (RN has no CSS color-mix).
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  // Guard non-hex input (named color, gradient, malformed) so callers never get
  // "rgba(NaN, ...)" - return the value unchanged for RN's color parser to handle.
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return hex
  }
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
