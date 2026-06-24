import { fireEvent, render, screen } from '@testing-library/react-native'

import type { TripEvent } from '@/features/timeline'

import { CockpitTimeline } from './cockpit-timeline'

function makeEvent(overrides: Partial<TripEvent> = {}): TripEvent {
  return {
    id: 'e1',
    trip_id: 't1',
    title: 'Dinner at Time Out Market',
    type: 'food',
    starts_at: '2026-06-15T15:20:00Z',
    ends_at: null,
    location: null,
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TripEvent
}

const NOW = new Date('2026-06-15T12:00:00Z').getTime()

describe('CockpitTimeline', () => {
  it('renders nothing when there are no events', () => {
    const { toJSON } = render(<CockpitTimeline events={[]} now={NOW} onPressEvent={jest.fn()} />)

    expect(toJSON()).toBeNull()
  })

  it('renders the first event as the NEXT card with its title and notes', () => {
    render(
      <CockpitTimeline
        events={[makeEvent({ notes: 'Table for 4' })]}
        now={NOW}
        onPressEvent={jest.fn()}
      />,
    )

    expect(screen.getByText('Next')).toBeOnTheScreen()
    expect(screen.getByText('Dinner at Time Out Market')).toBeOnTheScreen()
    expect(screen.getByText('Table for 4')).toBeOnTheScreen()
  })

  it('renders the following events as rows', () => {
    render(
      <CockpitTimeline
        events={[
          makeEvent({ id: 'e1', title: 'Dinner' }),
          makeEvent({ id: 'e2', title: 'Fado night', starts_at: '2026-06-15T18:00:00Z' }),
        ]}
        now={NOW}
        onPressEvent={jest.fn()}
      />,
    )

    expect(screen.getByText('Dinner')).toBeOnTheScreen()
    expect(screen.getByText('Fado night')).toBeOnTheScreen()
  })

  it('calls onPressEvent with the event id when pressed', () => {
    const onPressEvent = jest.fn()
    render(
      <CockpitTimeline
        events={[makeEvent({ id: 'e1', title: 'Dinner' })]}
        now={NOW}
        onPressEvent={onPressEvent}
      />,
    )

    fireEvent.press(screen.getByRole('button', { name: 'Dinner' }))

    expect(onPressEvent).toHaveBeenCalledWith('e1')
  })
})
