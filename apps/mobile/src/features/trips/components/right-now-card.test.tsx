import { render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import type { TripEvent } from '@/features/timeline'

import { RightNowCard } from './right-now-card'

function makeEvent(overrides: Partial<TripEvent> = {}): TripEvent {
  return {
    id: 'e1',
    trip_id: 't1',
    title: 'Tram 28 sightseeing',
    type: 'transport',
    starts_at: '2026-06-15T11:00:00Z',
    ends_at: '2026-06-15T13:00:00Z',
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

describe('RightNowCard', () => {
  it('renders the right-now label, the in-progress status and the event title', () => {
    render(<RightNowCard event={makeEvent()} now={NOW} />)

    expect(screen.getByText('Right now')).toBeOnTheScreen()
    expect(screen.getByText('In progress')).toBeOnTheScreen()
    expect(screen.getByText('Tram 28 sightseeing')).toBeOnTheScreen()
  })

  it('shows the minutes left when under an hour remains', () => {
    render(<RightNowCard event={makeEvent({ ends_at: '2026-06-15T12:38:00Z' })} now={NOW} />)

    expect(screen.getByText('38m left')).toBeOnTheScreen()
  })

  it('shows hours and minutes left when more than an hour remains', () => {
    render(<RightNowCard event={makeEvent({ ends_at: '2026-06-15T13:20:00Z' })} now={NOW} />)

    expect(screen.getByText('1h 20m left')).toBeOnTheScreen()
  })

  it('omits the time-left label when the event has no end', () => {
    render(<RightNowCard event={makeEvent({ ends_at: null })} now={NOW} />)

    expect(screen.queryByText(/left/)).toBeNull()
  })

  it('does not dim the card when participants is null (everyone)', () => {
    render(<RightNowCard event={makeEvent()} now={NOW} members={members} userId="u1" />)

    expect(hasStyle({ opacity: 0.55 })).toBe(false)
  })

  it('dims the card and shows the participant avatar stack when the user is outside the subset', () => {
    render(
      <RightNowCard
        event={makeEvent({ participants: ['u2'] })}
        now={NOW}
        members={members}
        userId="u1"
      />,
    )

    expect(hasStyle({ opacity: 0.55 })).toBe(true)
    expect(screen.getByLabelText('Marc')).toBeOnTheScreen()
  })

  it('does not dim the card when the user is part of the participants subset', () => {
    render(
      <RightNowCard
        event={makeEvent({ participants: ['u1', 'u2'] })}
        now={NOW}
        members={members}
        userId="u1"
      />,
    )

    expect(hasStyle({ opacity: 0.55 })).toBe(false)
  })
})
