import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { EVENT_TYPES } from '@/features/timeline'

import { EventTypePicker } from './event-type-picker'

// English labels resolved by the real i18n instance (jest-setup) for events.types.*.
const TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  flight: 'Flight',
  lodging: 'Lodging',
  transport: 'Transport',
  activity: 'Activity',
  food: 'Food',
  event: 'Event',
}

describe('EventTypePicker', () => {
  it('renders the label', () => {
    render(<EventTypePicker label="Type" value="flight" onChange={() => {}} />)

    expect(screen.getByText('Type')).toBeOnTheScreen()
  })

  it('renders one chip per canonical event type with its translated label', () => {
    render(<EventTypePicker label="Type" value="flight" onChange={() => {}} />)

    for (const type of EVENT_TYPES) {
      expect(screen.getByText(TYPE_LABELS[type])).toBeOnTheScreen()
    }
    expect(screen.getAllByRole('button')).toHaveLength(EVENT_TYPES.length)
  })

  it('marks the chip matching value as selected and the others as not', () => {
    render(<EventTypePicker label="Type" value="lodging" onChange={() => {}} />)

    // getByRole with selected:true finds only the active chip.
    expect(screen.getByRole('button', { name: 'Lodging', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Flight', selected: true })).toBeNull()
  })

  it('selects nothing when value is a legacy/non-canonical type', () => {
    render(<EventTypePicker label="Type" value="hotel" onChange={() => {}} />)

    // A legacy type ('hotel') matches no canonical chip - none are selected.
    expect(screen.queryAllByRole('button', { selected: true })).toHaveLength(0)
    expect(screen.getAllByRole('button')).toHaveLength(EVENT_TYPES.length)
  })

  it('calls onChange with the pressed type', () => {
    const onChange = jest.fn()
    render(<EventTypePicker label="Type" value="flight" onChange={onChange} />)

    fireEvent.press(screen.getByText('Food'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('food')
  })

  it('calls onChange even when the already-selected chip is pressed', () => {
    const onChange = jest.fn()
    render(<EventTypePicker label="Type" value="activity" onChange={onChange} />)

    fireEvent.press(screen.getByText('Activity'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('activity')
  })

  it('toggles the pressed style branch on pressIn / pressOut without throwing', () => {
    render(<EventTypePicker label="Type" value="flight" onChange={() => {}} />)

    const [chip] = screen.getAllByRole('button')

    expect(() => {
      fireEvent(chip, 'pressIn')
      fireEvent(chip, 'pressOut')
    }).not.toThrow()
  })

  it('returns the pressed style only while pressed (both arms of the style callback)', () => {
    render(<EventTypePicker label="Type" value="flight" onChange={() => {}} />)

    // The chips render Pressable with a function style; RN never toggles `pressed`
    // in the test renderer, so call both arms of the callback directly.
    const [pressable] = screen.root.findAll(
      (node: ReactTestInstance) => typeof node.props.style === 'function',
    )
    const styleFn = pressable.props.style as (state: { pressed: boolean }) => unknown

    expect(styleFn({ pressed: true })).toBeTruthy()
    expect(styleFn({ pressed: false })).toBeUndefined()
  })

  it('renders the selected branch for every canonical value', () => {
    for (const type of EVENT_TYPES) {
      const { unmount } = render(<EventTypePicker label="Type" value={type} onChange={() => {}} />)
      expect(
        screen.getByRole('button', { name: TYPE_LABELS[type], selected: true }),
      ).toBeOnTheScreen()
      unmount()
    }
  })
})
