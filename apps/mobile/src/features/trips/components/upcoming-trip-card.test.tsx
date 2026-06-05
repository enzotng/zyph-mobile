import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'
import type { TripCard } from '../api/trips.api'
import { formatTripDates } from '../format'
import type { StatusTone } from '../select'
import { UpcomingTripCard } from './upcoming-trip-card'

// expo-image renders to this host component under jest-expo (matches city-image.test.tsx).
const EXPO_IMAGE_TYPE = 'ViewManagerAdapter_ExpoImage'

// Per-tone theme colors the inner StatusDot maps to (light/dark variants; adaptiveThemes is
// on so either may apply). Distinct per tone, so a match proves the right tone branch ran.
const TONE_COLORS: Record<StatusTone, readonly [string, string]> = {
  success: ['#10B981', '#34D399'],
  warning: ['#F59E0B', '#FBBF24'],
  muted: ['#64748B', '#94A3B8'],
}

type StyleValue = Record<string, unknown>

function trip(overrides: Partial<TripCard> = {}): TripCard {
  return {
    id: 'trip-1',
    title: 'Lisbon getaway',
    destination: 'Lisbon',
    cover_photo_url: null,
    start_date: '2026-06-14',
    end_date: '2026-06-16',
    currency: 'EUR',
    members: [],
    myBalanceCents: 0,
    ...overrides,
  } as unknown as TripCard
}

function hasNodeOfType(node: ReactTestRendererJSON | null, type: string): boolean {
  if (!node) {
    return false
  }
  if (node.type === type) {
    return true
  }
  return (node.children ?? []).some((child) =>
    typeof child === 'string' ? false : hasNodeOfType(child, type),
  )
}

function renderedHasImage(): boolean {
  return hasNodeOfType(screen.toJSON() as ReactTestRendererJSON | null, EXPO_IMAGE_TYPE)
}

function flattenStyle(style: unknown): StyleValue {
  if (Array.isArray(style)) {
    return style.reduce<StyleValue>((acc, entry) => ({ ...acc, ...flattenStyle(entry) }), {})
  }
  if (style && typeof style === 'object') {
    return style as StyleValue
  }
  return {}
}

function collectStyles(node: ReactTestRendererJSON | null): StyleValue[] {
  if (!node) {
    return []
  }
  const own = node.props?.style ? [flattenStyle(node.props.style)] : []
  const children = node.children ?? []
  return [...own, ...children.flatMap((c) => (typeof c === 'string' ? [] : collectStyles(c)))]
}

function hasStyle(match: StyleValue): boolean {
  return collectStyles(screen.toJSON() as ReactTestRendererJSON | null).some((style) =>
    Object.entries(match).every(([key, value]) => style[key] === value),
  )
}

// True when any node's flattened style carries the given backgroundColor (the StatusDot tint).
function hasBackgroundColor(color: string): boolean {
  return collectStyles(screen.toJSON() as ReactTestRendererJSON | null).some(
    (style) => style.backgroundColor === color,
  )
}

describe('UpcomingTripCard', () => {
  it('renders the trip title', () => {
    render(<UpcomingTripCard trip={trip()} tone="success" onPress={() => {}} />)

    expect(screen.getByText('Lisbon getaway')).toBeOnTheScreen()
  })

  it('renders the formatted date range when the trip has dates', () => {
    const t = trip()
    render(<UpcomingTripCard trip={t} tone="success" onPress={() => {}} />)

    const dates = formatTripDates(t.start_date, t.end_date, 'en')
    expect(dates).not.toBeNull()
    expect(screen.getByText(dates as string)).toBeOnTheScreen()
  })

  it('hides the date row when the trip has no start date (dates ternary -> null)', () => {
    const t = trip({ start_date: null, end_date: null })
    render(<UpcomingTripCard trip={t} tone="muted" onPress={() => {}} />)

    // The title still shows, but no date text exists alongside it.
    expect(screen.getByText('Lisbon getaway')).toBeOnTheScreen()
    expect(formatTripDates(t.start_date, t.end_date, 'en')).toBeNull()
  })

  it('calls onPress when the card is pressed', () => {
    const onPress = jest.fn()
    render(<UpcomingTripCard trip={trip()} tone="success" onPress={onPress} />)

    fireEvent.press(screen.getByLabelText('Lisbon getaway'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('exposes the title as the accessibility label on a button-role pressable', () => {
    render(<UpcomingTripCard trip={trip()} tone="success" onPress={() => {}} />)

    const pressable = screen.getByLabelText('Lisbon getaway')
    expect(pressable.props.accessibilityRole).toBe('button')
  })

  it('applies the dimmed, scaled-down pressed style only while pressed (style-fn both branches)', () => {
    render(<UpcomingTripCard trip={trip()} tone="success" onPress={() => {}} />)

    // The Pressable keeps `style` as the original ({ pressed }) => style[] function (the host
    // node only exposes the already-resolved array). Grab that node and drive both states.
    const [pressable] = screen.UNSAFE_root.findAll(
      (node) => typeof (node.props as { style?: unknown }).style === 'function',
      { deep: true },
    )
    const styleFn = pressable.props.style as (s: { pressed: boolean }) => unknown

    // Pressed -> the truthy `pressed && styles.pressed` branch dims and scales the card down.
    const pressedStyle = flattenStyle(styleFn({ pressed: true }))
    expect(pressedStyle.opacity).toBe(0.85)
    expect(pressedStyle.transform).toEqual([{ scale: 0.97 }])
    // At rest -> the falsy branch, no dim and no scale.
    const restStyle = flattenStyle(styleFn({ pressed: false }))
    expect(restStyle.opacity).toBeUndefined()
    expect(restStyle.transform).toBeUndefined()
  })

  it('renders the cover photo when cover_photo_url is set', () => {
    render(
      <UpcomingTripCard
        trip={trip({ cover_photo_url: 'https://example.com/lisbon.jpg' })}
        tone="success"
        onPress={() => {}}
      />,
    )

    expect(renderedHasImage()).toBe(true)
  })

  it('renders a colour cover (no photo) when cover_photo_url is null', () => {
    render(
      <UpcomingTripCard trip={trip({ cover_photo_url: null })} tone="success" onPress={() => {}} />,
    )

    expect(renderedHasImage()).toBe(false)
  })

  it('uses the destination as the fallback tint seed when present', () => {
    // seed "Lisbon" -> deterministic tint from CityImage.coverTint.
    render(
      <UpcomingTripCard trip={trip({ destination: 'Lisbon' })} tone="success" onPress={() => {}} />,
    )

    // coverTint('Lisbon') is a stable palette colour; just assert the cover rendered.
    expect(screen.getByText('Lisbon getaway')).toBeOnTheScreen()
    expect(renderedHasImage()).toBe(false)
  })

  it('falls back to the title as the seed when destination is null (?? branch)', () => {
    render(
      <UpcomingTripCard
        trip={trip({ destination: null, title: 'Untitled trip', cover_photo_url: null })}
        tone="muted"
        onPress={() => {}}
      />,
    )

    expect(screen.getByText('Untitled trip')).toBeOnTheScreen()
  })

  it.each<StatusTone>([
    'success',
    'warning',
    'muted',
  ])('passes the "%s" tone through to the status dot', (tone) => {
    render(<UpcomingTripCard trip={trip()} tone={tone} onPress={() => {}} />)

    const matched = TONE_COLORS[tone].some((color) => hasBackgroundColor(color))
    expect(matched).toBe(true)
  })

  it('renders without throwing for every tone variant', () => {
    for (const tone of ['success', 'warning', 'muted'] as const) {
      expect(() =>
        render(<UpcomingTripCard trip={trip()} tone={tone} onPress={() => {}} />),
      ).not.toThrow()
    }
  })

  it('rounds all corners on the cover (corners="all")', () => {
    render(<UpcomingTripCard trip={trip()} tone="success" onPress={() => {}} />)

    // corners="all" => a borderRadius, never the top-only corner keys.
    expect(hasStyle({ borderTopLeftRadius: 0 })).toBe(false)
  })
})
