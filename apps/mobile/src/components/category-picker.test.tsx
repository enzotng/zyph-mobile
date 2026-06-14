import { fireEvent, render, screen } from '@testing-library/react-native'

import { CategoryPicker } from './category-picker'

describe('CategoryPicker', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the placeholder when no category is selected', () => {
    render(<CategoryPicker value={null} onChange={jest.fn()} />)
    expect(screen.getByText('None')).toBeOnTheScreen()
  })

  it('shows the selected category label on the field', () => {
    render(<CategoryPicker value="food" onChange={jest.fn()} />)
    expect(screen.getByText('Food')).toBeOnTheScreen()
  })

  it('renders the field label when provided', () => {
    render(<CategoryPicker label="Category" value={null} onChange={jest.fn()} />)
    expect(screen.getByText('Category')).toBeOnTheScreen()
  })

  it('opens the sheet and selects a category', () => {
    const onChange = jest.fn()
    render(<CategoryPicker value={null} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button', { name: 'Category' }))
    fireEvent.press(screen.getByRole('radio', { name: 'Transport' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('transport')
  })

  it('selects "none" from the sheet', () => {
    const onChange = jest.fn()
    render(<CategoryPicker value="food" onChange={onChange} />)

    fireEvent.press(screen.getByRole('button', { name: 'Category' }))
    fireEvent.press(screen.getByRole('radio', { name: 'None' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it.each([
    'food',
    'transport',
    'lodging',
    'activity',
    'shopping',
    'other',
  ] as const)('renders without throwing when "%s" is selected', (category) => {
    expect(() => render(<CategoryPicker value={category} onChange={jest.fn()} />)).not.toThrow()
  })
})
