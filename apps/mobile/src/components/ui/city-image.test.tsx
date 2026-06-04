import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import { CityImage, coverTint } from './city-image'

// The scrim is the only View carrying this exact translucent slate background.
const SCRIM_COLOR = 'rgba(15, 23, 42, 0.5)'
// expo-image renders to this host component under jest-expo.
const EXPO_IMAGE_TYPE = 'ViewManagerAdapter_ExpoImage'

type StyleValue = Record<string, unknown>

// Walk the rendered JSON tree and report whether any node matches the host type.
function hasNodeOfType(node: ReactTestRendererJSON | null, type: string): boolean {
  if (!node) {
    return false
  }
  if (node.type === type) {
    return true
  }
  const children = node.children ?? []
  return children.some((child) => (typeof child === 'string' ? false : hasNodeOfType(child, type)))
}

function renderedHasImage(): boolean {
  const tree = screen.toJSON() as ReactTestRendererJSON | null
  return hasNodeOfType(tree, EXPO_IMAGE_TYPE)
}

// Flatten a node's `style` prop (object | array | nested arrays) into a single object.
function flattenStyle(style: unknown): StyleValue {
  if (Array.isArray(style)) {
    return style.reduce<StyleValue>((acc, entry) => ({ ...acc, ...flattenStyle(entry) }), {})
  }
  if (style && typeof style === 'object') {
    return style as StyleValue
  }
  return {}
}

// Collect the flattened style of every node in the rendered tree.
function collectStyles(node: ReactTestRendererJSON | null): StyleValue[] {
  if (!node) {
    return []
  }
  const own = node.props?.style ? [flattenStyle(node.props.style)] : []
  const children = node.children ?? []
  const nested = children.flatMap((child) =>
    typeof child === 'string' ? [] : collectStyles(child),
  )
  return [...own, ...nested]
}

// True when some rendered node has a flattened style matching every key/value in `match`.
function hasStyle(match: StyleValue): boolean {
  const tree = screen.toJSON() as ReactTestRendererJSON | null
  return collectStyles(tree).some((style) =>
    Object.entries(match).every(([key, value]) => style[key] === value),
  )
}

describe('coverTint', () => {
  it('returns the first tint when seed is undefined', () => {
    expect(coverTint(undefined)).toBe('#4F46E5')
  })

  it('returns the first tint when seed is an empty string (falsy)', () => {
    expect(coverTint('')).toBe('#4F46E5')
  })

  it('returns a deterministic tint derived from the seed', () => {
    expect(coverTint('paris')).toBe('#0891B2')
    expect(coverTint('tokyo')).toBe('#8B5CF6')
  })

  it('returns the same tint for the same seed across calls', () => {
    expect(coverTint('lisbon')).toBe(coverTint('lisbon'))
  })

  it('always returns a value from the fallback palette', () => {
    const palette = [
      '#4F46E5',
      '#6366F1',
      '#0EA5E9',
      '#0891B2',
      '#2563EB',
      '#0D9488',
      '#8B5CF6',
      '#DB2777',
    ]
    for (const seed of ['rome', 'berlin', 'madrid', 'oslo', 'cairo', 'delhi']) {
      expect(palette).toContain(coverTint(seed))
    }
  })
})

describe('CityImage', () => {
  it('renders children overlay content', () => {
    render(
      <CityImage seed="paris" height={120}>
        <Text>Overlay title</Text>
      </CityImage>,
    )

    // Children passed to CityImage are rendered inside the cover container.
    expect(screen.getByText('Overlay title')).toBeOnTheScreen()
  })

  it('applies the deterministic tint as the container background', () => {
    render(<CityImage seed="paris" height={140} />)

    expect(hasStyle({ backgroundColor: '#0891B2', height: 140 })).toBe(true)
  })

  it('renders the photo when a uri is provided', () => {
    render(<CityImage uri="https://example.com/photo.jpg" seed="paris" height={120} />)

    expect(renderedHasImage()).toBe(true)
  })

  it('does not render a photo when uri is absent', () => {
    render(<CityImage seed="paris" height={120} />)

    expect(renderedHasImage()).toBe(false)
  })

  it('does not render a photo when uri is null', () => {
    render(<CityImage uri={null} seed="paris" height={120} />)

    expect(renderedHasImage()).toBe(false)
  })

  it('renders the scrim by default when a uri is present', () => {
    render(<CityImage uri="https://example.com/photo.jpg" seed="paris" height={120} />)

    expect(screen.UNSAFE_queryByProps({ pointerEvents: 'none' })).not.toBeNull()
    expect(hasStyle({ backgroundColor: SCRIM_COLOR })).toBe(true)
  })

  it('does not render the scrim when scrim is false even with a uri', () => {
    render(
      <CityImage uri="https://example.com/photo.jpg" seed="paris" height={120} scrim={false} />,
    )

    expect(hasStyle({ backgroundColor: SCRIM_COLOR })).toBe(false)
  })

  it('does not render the scrim when there is no uri even if scrim is true', () => {
    render(<CityImage seed="paris" height={120} scrim />)

    expect(hasStyle({ backgroundColor: SCRIM_COLOR })).toBe(false)
  })

  it('rounds all corners by default', () => {
    render(<CityImage seed="paris" height={120} radius={16} />)

    expect(hasStyle({ borderRadius: 16 })).toBe(true)
    expect(hasStyle({ borderTopLeftRadius: 16 })).toBe(false)
  })

  it('rounds only the top corners when corners is "top"', () => {
    render(<CityImage seed="paris" height={120} radius={16} corners="top" />)

    expect(hasStyle({ borderTopLeftRadius: 16, borderTopRightRadius: 16 })).toBe(true)
    expect(hasStyle({ borderRadius: 16 })).toBe(false)
  })

  it('falls back to the theme radius when no radius prop is given', () => {
    render(<CityImage seed="paris" height={120} />)

    // No explicit radius => the theme value is used, never 16 (the explicit-prop value).
    expect(hasStyle({ borderRadius: 16 })).toBe(false)
    expect(hasStyle({ backgroundColor: '#0891B2' })).toBe(true)
  })

  it('applies the provided style to the container', () => {
    render(<CityImage seed="paris" height={120} style={{ opacity: 0.5 }} />)

    expect(hasStyle({ opacity: 0.5 })).toBe(true)
  })
})
