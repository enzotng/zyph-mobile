import { fireEvent, render, screen } from '@testing-library/react-native'

import { EventCategoryPicker } from './event-category-picker'

describe('EventCategoryPicker', () => {
  it('renders the events-flagged roots and hides fees', () => {
    render(
      <EventCategoryPicker label="Type" category="other" subcategory={null} onChange={() => {}} />,
    )
    expect(screen.getByText('Transport')).toBeTruthy()
    expect(screen.queryByText('Fees & admin')).toBeNull()
  })

  it('selecting a root emits it and clears the subcategory', () => {
    const onChange = jest.fn()
    render(
      <EventCategoryPicker
        label="Type"
        category="other"
        subcategory="other.event"
        onChange={onChange}
      />,
    )
    fireEvent.press(screen.getByText('Transport'))
    expect(onChange).toHaveBeenCalledWith({ category: 'transport', subcategory: null })
  })

  it('opens the subcategory sheet and emits a leaf', () => {
    const onChange = jest.fn()
    render(
      <EventCategoryPicker
        label="Type"
        category="transport"
        subcategory={null}
        onChange={onChange}
      />,
    )
    fireEvent.press(screen.getByLabelText('Subcategory'))
    fireEvent.press(screen.getByText('Flight'))
    expect(onChange).toHaveBeenCalledWith({
      category: 'transport',
      subcategory: 'transport.flight',
    })
  })
})
