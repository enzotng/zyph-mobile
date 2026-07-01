import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Poi } from '@/features/places'
import type { NewItineraryEvent } from '@/features/timeline'

import type { ItineraryBlock as ItineraryBlockData } from '../schemas'
import { ItineraryBlock } from './itinerary-block'

// Stub out usePoiPhoto so no network or query provider is needed.
jest.mock('@/features/places', () => ({
  usePoiPhoto: () => ({ data: null }),
}))

// Stub supabase so transitive imports from timeline/event-types don't need a real client.
jest.mock('@/lib/supabase')

const BLOCK: ItineraryBlockData = {
  kind: 'itinerary',
  days: [
    {
      date: '2025-12-01',
      items: [
        { placeId: 'place-1', title: 'Visit the museum', type: 'activity', time: '10:00' },
        { placeId: 'place-2', title: 'Dinner at the market', type: 'food', time: '19:00' },
      ],
    },
  ],
}

const CANDIDATES: Poi[] = [
  {
    placeId: 'place-1',
    name: 'National Museum',
    lat: 48.1,
    lng: 2.1,
    rating: 4.5,
    ratingCount: 120,
    priceLevel: null,
    types: ['museum'],
    photoName: null,
    address: null,
    openNow: null,
  },
  {
    placeId: 'place-2',
    name: 'Market Restaurant',
    lat: 48.2,
    lng: 2.2,
    rating: null,
    ratingCount: null,
    priceLevel: 2,
    types: ['restaurant'],
    photoName: null,
    address: null,
    openNow: true,
  },
]

function renderBlock(overrides: Partial<Parameters<typeof ItineraryBlock>[0]> = {}) {
  const onAdd = jest.fn()
  const onRegenerate = jest.fn()
  render(
    <ItineraryBlock
      block={BLOCK}
      candidates={CANDIDATES}
      onAdd={onAdd}
      onRegenerate={onRegenerate}
      {...overrides}
    />,
  )
  return { onAdd, onRegenerate }
}

describe('ItineraryBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders both item titles and the day date', () => {
    renderBlock()

    expect(screen.getByDisplayValue('Visit the museum')).toBeTruthy()
    expect(screen.getByDisplayValue('Dinner at the market')).toBeTruthy()
    expect(screen.getByText('2025-12-01')).toBeTruthy()
  })

  it('tapping "Add to timeline" calls onAdd with 2 events with correct startsAt, placeId, lat, lng', () => {
    const { onAdd } = renderBlock()

    fireEvent.press(screen.getByText('Add to timeline'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const events: NewItineraryEvent[] = onAdd.mock.calls[0][0]
    expect(events).toHaveLength(2)

    expect(events[0].placeId).toBe('place-1')
    expect(events[0].lat).toBe(48.1)
    expect(events[0].lng).toBe(2.1)
    expect(events[0].startsAt).toBe(new Date('2025-12-01T10:00:00').toISOString())

    expect(events[1].placeId).toBe('place-2')
    expect(events[1].lat).toBe(48.2)
    expect(events[1].lng).toBe(2.2)
    expect(events[1].startsAt).toBe(new Date('2025-12-01T19:00:00').toISOString())
  })

  it('toggling item 1 off then Add calls onAdd with only item 2', () => {
    const { onAdd } = renderBlock()

    fireEvent.press(screen.getByTestId('toggle-0:0'))
    fireEvent.press(screen.getByText('Add to timeline'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const events: NewItineraryEvent[] = onAdd.mock.calls[0][0]
    expect(events).toHaveLength(1)
    expect(events[0].placeId).toBe('place-2')
  })

  it('editing item 1 title then Add sends the updated title in the payload', () => {
    const { onAdd } = renderBlock()

    fireEvent.changeText(screen.getByDisplayValue('Visit the museum'), 'Updated museum title')
    fireEvent.press(screen.getByText('Add to timeline'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const events: NewItineraryEvent[] = onAdd.mock.calls[0][0]
    expect(events[0].title).toBe('Updated museum title')
  })

  it('tapping "Regenerate" calls onRegenerate', () => {
    const { onRegenerate } = renderBlock()

    fireEvent.press(screen.getByText('Regenerate'))

    expect(onRegenerate).toHaveBeenCalledTimes(1)
  })
})
