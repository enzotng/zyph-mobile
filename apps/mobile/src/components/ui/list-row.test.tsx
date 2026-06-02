import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { ListRow } from './list-row'

describe('ListRow', () => {
  it('renders the title', () => {
    render(<ListRow title="Settings" />)

    expect(screen.getByText('Settings')).toBeOnTheScreen()
  })

  it('renders subtitle and detail when provided', () => {
    render(<ListRow title="Trip" subtitle="Paris 2025" detail="3 members" />)

    expect(screen.getByText('Paris 2025')).toBeOnTheScreen()
    expect(screen.getByText('3 members')).toBeOnTheScreen()
  })

  it('calls onPress when the row is pressed', () => {
    const onPress = jest.fn()
    render(<ListRow title="Notifications" onPress={onPress} />)

    fireEvent.press(screen.getByText('Notifications'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders a custom right node when provided', () => {
    render(<ListRow title="Language" right={<Text>English</Text>} />)

    expect(screen.getByText('English')).toBeOnTheScreen()
  })

  it('renders without throwing for danger and last variants', () => {
    expect(() =>
      render(<ListRow title="Delete account" danger last icon="trash" onPress={() => {}} />),
    ).not.toThrow()
  })

  it('renders as a non-interactive view when no onPress is given', () => {
    render(<ListRow title="Version" detail="1.0.0" />)

    expect(screen.getByText('Version')).toBeOnTheScreen()
  })
})
