import { fireEvent, render, screen } from '@testing-library/react-native'

import { QuickAction } from './quick-action'

describe('QuickAction', () => {
  it('renders the label', () => {
    render(<QuickAction icon="add" label="Add expense" />)

    expect(screen.getByText('Add expense')).toBeOnTheScreen()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    render(<QuickAction icon="add" label="Add expense" onPress={onPress} />)

    fireEvent.press(screen.getByText('Add expense'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders with a custom tone without throwing', () => {
    expect(() => render(<QuickAction icon="car" label="Transport" tone="#E85D04" />)).not.toThrow()
  })
})
