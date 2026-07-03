import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Poi } from '../poi.types'
import { formatCount, PoiCard } from './poi-card'

// Stub usePoiPhoto so no network or query provider is needed (same pattern as
// itinerary-block.test.tsx).
jest.mock('../hooks/use-poi-photo', () => ({ usePoiPhoto: () => ({ data: null }) }))

const POI: Poi = {
  placeId: 'place-1',
  name: 'National Museum of a Very Long Name That Wraps',
  lat: 48.1,
  lng: 2.1,
  rating: 4.7,
  ratingCount: 12345,
  priceLevel: 1,
  types: ['museum'],
  photoName: null,
  address: null,
  openNow: null,
  description: null,
  typeLabel: null,
  priceStart: null,
  priceEnd: null,
  priceCurrency: null,
  weekdayHours: null,
}

function renderCard(overrides: Partial<Parameters<typeof PoiCard>[0]> = {}) {
  const onPress = jest.fn()
  render(<PoiCard poi={POI} onPress={onPress} {...overrides} />)
  return { onPress }
}

describe('formatCount', () => {
  it('returns the plain number under 1000', () => {
    expect(formatCount(999)).toBe('999')
  })

  it('formats thousands compactly (12 345 -> "12k")', () => {
    expect(formatCount(12345)).toBe('12k')
  })

  it('formats an exact thousand as "1k"', () => {
    expect(formatCount(1000)).toBe('1k')
  })

  it('formats millions compactly', () => {
    expect(formatCount(2_500_000)).toBe('2M')
  })
})

describe('PoiCard', () => {
  it('renders the POI name', () => {
    renderCard()

    expect(screen.getByText(POI.name)).toBeOnTheScreen()
  })

  it('renders the rating and compact rating count', () => {
    renderCard()

    expect(screen.getByText('★ 4.7 (12k)')).toBeOnTheScreen()
  })

  it('renders the rating alone when the rating count is null', () => {
    renderCard({ poi: { ...POI, ratingCount: null } })

    expect(screen.getByText('★ 4.7')).toBeOnTheScreen()
  })

  it('does not render a rating line when rating is null', () => {
    renderCard({ poi: { ...POI, rating: null, ratingCount: null } })

    expect(screen.queryByText(/★/)).toBeNull()
  })

  it('renders the price level as repeated dollar signs', () => {
    renderCard()

    // priceLevel 1 -> '$'.repeat(1 + 1) = '$$'
    expect(screen.getByText('$$')).toBeOnTheScreen()
  })

  it('hides the price when priceLevel is null', () => {
    renderCard({ poi: { ...POI, priceLevel: null } })

    expect(screen.queryByText('$')).toBeNull()
  })

  it('shows the category label when provided', () => {
    renderCard({ categoryLabel: 'Museums' })

    expect(screen.getByText('Museums')).toBeOnTheScreen()
  })

  it('hides the category label when omitted', () => {
    renderCard()

    expect(screen.queryByText('Museums')).toBeNull()
  })

  it('shows the "in your plan" badge when inPlan is true', () => {
    renderCard({ inPlan: true })

    expect(screen.getByText('In your plan')).toBeOnTheScreen()
  })

  it('hides the "in your plan" badge by default', () => {
    renderCard()

    expect(screen.queryByText('In your plan')).toBeNull()
  })

  it('calls onPress when pressed', () => {
    const { onPress } = renderCard()

    fireEvent.press(screen.getByLabelText(POI.name))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('exposes the POI name as the accessibility label on a button-role pressable', () => {
    renderCard()

    const pressable = screen.getByLabelText(POI.name)
    expect(pressable.props.accessibilityRole).toBe('button')
  })
})
