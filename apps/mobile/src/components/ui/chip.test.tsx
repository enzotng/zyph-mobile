import { fireEvent, render, screen } from '@testing-library/react-native'

import { Chip, MemberChip } from './chip'

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip label="Transport" />)

    expect(screen.getByText('Transport')).toBeOnTheScreen()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    render(<Chip label="Hotel" onPress={onPress} />)

    fireEvent.press(screen.getByText('Hotel'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders selected state without throwing', () => {
    expect(() => render(<Chip label="Food" selected icon="restaurant" />)).not.toThrow()
  })

  it('renders unselected state without throwing', () => {
    expect(() => render(<Chip label="Flight" selected={false} icon="airplane" />)).not.toThrow()
  })
})

describe('MemberChip', () => {
  it('renders the uppercased initial from the initial prop', () => {
    render(<MemberChip initial="a" name="Alice" />)

    expect(screen.getByText('A')).toBeOnTheScreen()
  })

  it('derives the initial from the name when initial is not provided', () => {
    render(<MemberChip name="Bob" />)

    expect(screen.getByText('B')).toBeOnTheScreen()
  })

  it('falls back to "?" when neither initial nor name is provided', () => {
    render(<MemberChip />)

    expect(screen.getByText('?')).toBeOnTheScreen()
  })

  it('enforces a minimum tap target of 44 even when a smaller size is passed', () => {
    render(<MemberChip name="Carol" size={20} />)

    expect(screen.getByLabelText('Carol')).toHaveStyle({ width: 44, height: 44 })
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    render(<MemberChip name="Dave" onPress={onPress} />)

    fireEvent.press(screen.getByText('D'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders selected state without throwing', () => {
    expect(() => render(<MemberChip name="Eve" selected />)).not.toThrow()
  })
})
