import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

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

const members = [
  { id: 'm1', user_id: 'u1', display_name: 'Zoe', avatar_url: null },
  { id: 'm2', user_id: 'u2', display_name: 'Marc', avatar_url: null },
]

type StyleValue = Record<string, unknown>

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

  it('does not dim the NEXT card when participants is null (everyone)', () => {
    render(
      <CockpitTimeline
        events={[makeEvent()]}
        now={NOW}
        onPressEvent={jest.fn()}
        members={members}
        userId="u1"
      />,
    )

    expect(hasStyle({ opacity: 0.55 })).toBe(false)
  })

  it('dims the NEXT card and shows the participant avatar stack when the user is outside the subset', () => {
    render(
      <CockpitTimeline
        events={[makeEvent({ participants: ['u2'] })]}
        now={NOW}
        onPressEvent={jest.fn()}
        members={members}
        userId="u1"
      />,
    )

    expect(hasStyle({ opacity: 0.55 })).toBe(true)
    expect(screen.getByLabelText('Marc')).toBeOnTheScreen()
  })

  it('dims a following row when the signed-in user is outside its participants subset', () => {
    render(
      <CockpitTimeline
        events={[
          makeEvent({ id: 'e1', title: 'Dinner' }),
          makeEvent({
            id: 'e2',
            title: 'Fado night',
            starts_at: '2026-06-15T18:00:00Z',
            participants: ['u2'],
          }),
        ]}
        now={NOW}
        onPressEvent={jest.fn()}
        members={members}
        userId="u1"
      />,
    )

    expect(hasStyle({ opacity: 0.55 })).toBe(true)
  })
})
