import { fireEvent, render, screen } from '@testing-library/react-native'

import { Button } from './button'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button label="Get started" />)

    expect(screen.getByText('Get started')).toBeOnTheScreen()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    render(<Button label="Continue" onPress={onPress} />)

    fireEvent.press(screen.getByText('Continue'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    render(<Button label="Save" onPress={onPress} disabled />)

    fireEvent.press(screen.getByText('Save'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('renders each variant and size', () => {
    expect(() =>
      render(<Button label="Delete" variant="destructive" size="sm" icon="trash" block={false} />),
    ).not.toThrow()
    expect(() => render(<Button label="Skip" variant="ghost" />)).not.toThrow()
  })
})
