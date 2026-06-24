import { render } from '@testing-library/react-native'

import { StatusDot, type StatusDotTone } from './status-dot'

// Theme tokens the dot maps each tone to (light and dark variants from unistyles.ts).
// adaptiveThemes is on, so the active theme follows the system scheme in tests; we accept
// either variant and rely on the per-tone colors being distinct to prove each branch ran.
const TONE_COLORS: Record<StatusDotTone, readonly [string, string]> = {
  success: ['#2F7D57', '#5FB98C'],
  warning: ['#C98A2B', '#D8A24A'],
  muted: ['#8C8578', '#9A9384'],
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flatten(item) }), {})
  }
  if (style && typeof style === 'object') {
    return style as Record<string, unknown>
  }
  return {}
}

function renderDotStyle(tone: StatusDotTone, size?: number): Record<string, unknown> {
  const { toJSON } = render(<StatusDot tone={tone} size={size} />)
  const tree = toJSON()
  if (tree === null || Array.isArray(tree)) {
    throw new Error('expected a single root view')
  }
  return flatten(tree.props.style)
}

describe('StatusDot', () => {
  it('renders a single view without throwing', () => {
    expect(() => render(<StatusDot tone="success" />)).not.toThrow()
  })

  it.each<StatusDotTone>([
    'success',
    'warning',
    'muted',
  ])('uses the theme color for the "%s" tone branch', (tone) => {
    const style = renderDotStyle(tone)

    expect(TONE_COLORS[tone]).toContain(style.backgroundColor)
  })

  it('maps every tone to a distinct color (each ternary branch is exercised)', () => {
    const colors = (['success', 'warning', 'muted'] as const).map(
      (tone) => renderDotStyle(tone).backgroundColor,
    )

    expect(new Set(colors).size).toBe(3)
  })

  it('defaults size to 12 for width, height and borderRadius', () => {
    const style = renderDotStyle('muted')

    expect(style.width).toBe(12)
    expect(style.height).toBe(12)
    expect(style.borderRadius).toBe(12)
  })

  it('applies an explicit size to width, height and borderRadius', () => {
    const style = renderDotStyle('success', 24)

    expect(style.width).toBe(24)
    expect(style.height).toBe(24)
    expect(style.borderRadius).toBe(24)
  })

  it('keeps the card-coloured ring border from the stylesheet', () => {
    const style = renderDotStyle('warning')

    expect(style.borderWidth).toBe(2)
    expect(style.borderColor).toBeDefined()
  })
})
