import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Poi } from '@/features/places'
import type { NewItineraryEvent } from '@/features/timeline'

import type { ItineraryBlock as ItineraryBlockData } from '../schemas'
import { ItineraryBlock } from './itinerary-block'

// Stub out usePoiPhoto so no network or query provider is needed.
jest.mock('@/features/places', () => ({
  usePoiPhoto: () => ({ data: null }),
}))

const BLOCK: ItineraryBlockData = {
  kind: 'itinerary',
  days: [
    {
      date: '2025-12-01',
      items: [
        {
          placeId: 'place-1',
          title: 'Visit the museum',
          category: 'activity',
          subcategory: 'activity.sightseeing',
          time: '10:00',
        },
        {
          placeId: 'place-2',
          title: 'Dinner at the market',
          category: 'food',
          subcategory: null,
          time: '19:00',
        },
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
    description: null,
    typeLabel: null,
    priceStart: null,
    priceEnd: null,
    priceCurrency: null,
    weekdayHours: null,
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
    description: null,
    typeLabel: null,
    priceStart: null,
    priceEnd: null,
    priceCurrency: null,
    weekdayHours: null,
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
    expect(events[0].category).toBe('activity')
    expect(events[0].subcategory).toBe('activity.sightseeing')

    expect(events[1].placeId).toBe('place-2')
    expect(events[1].lat).toBe(48.2)
    expect(events[1].lng).toBe(2.2)
    expect(events[1].startsAt).toBe(new Date('2025-12-01T19:00:00').toISOString())
    expect(events[1].category).toBe('food')
    expect(events[1].subcategory).toBeNull()
  })

  it('changing item 1 category via the taxonomy picker forwards the new category and clears the subcategory', () => {
    const { onAdd } = renderBlock()

    fireEvent.press(screen.getAllByText('Food & drink')[0])
    fireEvent.press(screen.getByText('Add to timeline'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const events: NewItineraryEvent[] = onAdd.mock.calls[0][0]
    expect(events[0].category).toBe('food')
    expect(events[0].subcategory).toBeNull()
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

  it('resolves lat/lng from an accumulated candidate present from an earlier turn', () => {
    // The block only references place-1 (an earlier turn), while the merged candidates array also
    // carries place-2 (a later search). Add-to-timeline must still emit place-1's coordinates from
    // the accumulated array - the whole point of persisting/merging candidates across turns.
    const block: ItineraryBlockData = {
      kind: 'itinerary',
      days: [
        {
          date: '2025-12-05',
          items: [
            {
              placeId: 'place-1',
              title: 'Old museum',
              category: 'activity',
              subcategory: null,
              time: '09:00',
            },
          ],
        },
      ],
    }
    const { onAdd } = renderBlock({ block, candidates: CANDIDATES })

    fireEvent.press(screen.getByText('Add to timeline'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    const events: NewItineraryEvent[] = onAdd.mock.calls[0][0]
    expect(events).toHaveLength(1)
    expect(events[0].placeId).toBe('place-1')
    expect(events[0].lat).toBe(48.1)
    expect(events[0].lng).toBe(2.1)
  })
})
