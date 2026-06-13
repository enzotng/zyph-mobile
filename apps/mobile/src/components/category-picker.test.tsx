import { fireEvent, render, screen } from '@testing-library/react-native'

import { CategoryPicker } from './category-picker'

// All chip labels as rendered through the bound i18n English resources.
const ALL_LABELS = ['None', 'Food', 'Transport', 'Lodging', 'Activity', 'Shopping', 'Other']

describe('CategoryPicker', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the "none" chip plus every expense category chip', () => {
    render(<CategoryPicker value={null} onChange={jest.fn()} />)

    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeOnTheScreen()
    }
  })

  it('renders the label when provided', () => {
    render(<CategoryPicker label="Category" value={null} onChange={jest.fn()} />)

    expect(screen.getByText('Category')).toBeOnTheScreen()
  })

  it('does not render a label when not provided', () => {
    render(<CategoryPicker value={null} onChange={jest.fn()} />)

    expect(screen.queryByText('Category')).toBeNull()
  })

  it('marks the "none" chip as selected when value is null', () => {
    render(<CategoryPicker value={null} onChange={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'None', selected: true })).toBeOnTheScreen()
  })

  it('does not mark category chips as selected when value is null', () => {
    render(<CategoryPicker value={null} onChange={jest.fn()} />)

    expect(screen.queryByRole('button', { name: 'Food', selected: true })).toBeNull()
  })

  it('marks the matching category chip as selected and "none" as unselected', () => {
    render(<CategoryPicker value="food" onChange={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Food', selected: true })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'None', selected: true })).toBeNull()
  })

  it('calls onChange with null when the "none" chip is pressed', () => {
    const onChange = jest.fn()
    render(<CategoryPicker value="food" onChange={onChange} />)

    fireEvent.press(screen.getByText('None'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with the category key when a category chip is pressed', () => {
    const onChange = jest.fn()
    render(<CategoryPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByText('Transport'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('transport')
  })

  it('still invokes onChange when the already-selected category chip is pressed again', () => {
    const onChange = jest.fn()
    render(<CategoryPicker value="lodging" onChange={onChange} />)

    fireEvent.press(screen.getByText('Lodging'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('lodging')
  })

  it.each([
    'food',
    'transport',
    'lodging',
    'activity',
    'shopping',
    'other',
  ] as const)('renders without throwing when "%s" is the selected value', (category) => {
    expect(() => render(<CategoryPicker value={category} onChange={jest.fn()} />)).not.toThrow()
  })
})
