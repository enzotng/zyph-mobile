import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Poi } from '../poi.types'
import { PoiHeroCard } from './poi-hero-card'

// Stub usePoiPhoto so no network or query provider is needed (same pattern as poi-card.test.tsx).
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
  typeLabel: 'History museum',
  priceStart: null,
  priceEnd: null,
  priceCurrency: null,
  weekdayHours: null,
}

function renderCard(overrides: Partial<Parameters<typeof PoiHeroCard>[0]> = {}) {
  const onPress = jest.fn()
  render(<PoiHeroCard poi={POI} width={280} onPress={onPress} {...overrides} />)
  return { onPress }
}

describe('PoiHeroCard', () => {
  it('renders the POI name', () => {
    renderCard()

    expect(screen.getByText(POI.name)).toBeOnTheScreen()
  })

  it('renders the type label as the eyebrow', () => {
    renderCard()

    expect(screen.getByText('HISTORY MUSEUM')).toBeOnTheScreen()
  })

  it('hides the eyebrow when typeLabel is absent', () => {
    renderCard({ poi: { ...POI, typeLabel: null } })

    expect(screen.queryByText('HISTORY MUSEUM')).toBeNull()
  })

  it('renders the rating and compact rating count', () => {
    renderCard()

    expect(screen.getByText('4.7 (12k)')).toBeOnTheScreen()
  })

  it('renders the rating alone when the rating count is null', () => {
    renderCard({ poi: { ...POI, ratingCount: null } })

    expect(screen.getByText('4.7')).toBeOnTheScreen()
  })

  it('does not render a rating line when rating is null', () => {
    renderCard({ poi: { ...POI, rating: null, ratingCount: null } })

    expect(screen.queryByText(/4\.7/)).toBeNull()
  })

  it('renders a price range when both bounds are known', () => {
    renderCard({ poi: { ...POI, priceStart: 10, priceEnd: 20, priceCurrency: 'EUR' } })

    expect(screen.getByText('10-20 EUR')).toBeOnTheScreen()
    expect(screen.queryByText('$$')).toBeNull()
  })

  it('falls back to the priceLevel dollar signs when no price range is known', () => {
    renderCard()

    // priceLevel 1 -> '$'.repeat(1 + 1) = '$$'
    expect(screen.getByText('$$')).toBeOnTheScreen()
  })

  it('hides the price when neither a price range nor a priceLevel is known', () => {
    renderCard({ poi: { ...POI, priceLevel: null } })

    expect(screen.queryByText('$$')).toBeNull()
    expect(screen.queryByText('$')).toBeNull()
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
