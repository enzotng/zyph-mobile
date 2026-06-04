import { fireEvent, render, screen } from '@testing-library/react-native'

import { POI_ICONS, type PoiIcon } from '@/features/wayfinder'

import { PoiIconPicker, poiIconName } from './poi-icon-picker'

describe('poiIconName', () => {
  it('maps each known POI icon to its Ionicon glyph', () => {
    const expected: Record<PoiIcon, string> = {
      pin: 'location',
      gate: 'airplane',
      bag: 'briefcase',
      food: 'restaurant',
      wc: 'water',
      cash: 'cash',
      taxi: 'car',
      wifi: 'wifi',
      star: 'star',
    }

    for (const icon of POI_ICONS) {
      expect(poiIconName(icon)).toBe(expected[icon])
    }
  })

  it('falls back to the location glyph for an unknown icon', () => {
    expect(poiIconName('not-a-real-icon')).toBe('location')
  })
})

describe('PoiIconPicker', () => {
  it('renders one button per POI icon', () => {
    render(<PoiIconPicker value="pin" onChange={() => {}} />)

    expect(screen.getAllByRole('button')).toHaveLength(POI_ICONS.length)
  })

  it('renders the label when provided', () => {
    render(<PoiIconPicker label="Pick an icon" value="pin" onChange={() => {}} />)

    expect(screen.getByText('Pick an icon')).toBeOnTheScreen()
  })

  it('does not render a label when none is provided', () => {
    render(<PoiIconPicker value="pin" onChange={() => {}} />)

    expect(screen.queryByText('Pick an icon')).not.toBeOnTheScreen()
  })

  it('marks the selected icon button and leaves the others unselected', () => {
    render(<PoiIconPicker value="food" onChange={() => {}} />)

    const buttons = screen.getAllByRole('button')
    const selected = buttons.filter((button) => button.props.accessibilityState?.selected)
    const unselected = buttons.filter((button) => !button.props.accessibilityState?.selected)

    expect(selected).toHaveLength(1)
    expect(unselected).toHaveLength(POI_ICONS.length - 1)
  })

  it('calls onChange with the pressed icon', () => {
    const onChange = jest.fn()
    render(<PoiIconPicker value="pin" onChange={onChange} />)

    fireEvent.press(screen.getAllByRole('button')[2])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(POI_ICONS[2])
  })

  it('calls onChange even when the already-selected icon is pressed', () => {
    const onChange = jest.fn()
    render(<PoiIconPicker value={POI_ICONS[0]} onChange={onChange} />)

    fireEvent.press(screen.getAllByRole('button')[0])

    expect(onChange).toHaveBeenCalledWith(POI_ICONS[0])
  })

  it('renders without throwing for every selectable icon value', () => {
    for (const icon of POI_ICONS) {
      expect(() => render(<PoiIconPicker value={icon} onChange={() => {}} />)).not.toThrow()
    }
  })
})
