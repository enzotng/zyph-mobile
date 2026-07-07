import { fireEvent, render, screen } from '@testing-library/react-native'

import { TaxonomyCategoryPicker } from './taxonomy-category-picker'

describe('TaxonomyCategoryPicker', () => {
  it('renders the events-flagged roots and hides fees', () => {
    render(
      <TaxonomyCategoryPicker
        label="Type"
        flag="events"
        category="other"
        subcategory={null}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Transport')).toBeTruthy()
    expect(screen.queryByText('Fees & admin')).toBeNull()
  })

  it('shows the fees root under the expenses flag', () => {
    render(
      <TaxonomyCategoryPicker
        label="Category"
        flag="expenses"
        category="other"
        subcategory={null}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Fees & admin')).toBeTruthy()
  })

  it('selecting a root emits it and clears the subcategory', () => {
    const onChange = jest.fn()
    render(
      <TaxonomyCategoryPicker
        label="Type"
        flag="events"
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
      <TaxonomyCategoryPicker
        label="Type"
        flag="events"
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

  it('renders a None chip when allowNone is set, selected when category is null', () => {
    render(
      <TaxonomyCategoryPicker
        label="Category"
        flag="expenses"
        category={null}
        subcategory={null}
        allowNone
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('None')).toBeTruthy()
  })

  it('pressing the None chip emits a null category and subcategory', () => {
    const onChange = jest.fn()
    render(
      <TaxonomyCategoryPicker
        label="Category"
        flag="expenses"
        category="transport"
        subcategory="transport.flight"
        allowNone
        onChange={onChange}
      />,
    )
    fireEvent.press(screen.getByText('None'))
    expect(onChange).toHaveBeenCalledWith({ category: null, subcategory: null })
  })

  it('does not render a None chip when allowNone is unset', () => {
    render(
      <TaxonomyCategoryPicker
        label="Type"
        flag="events"
        category="other"
        subcategory={null}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText('None')).toBeNull()
  })
})
