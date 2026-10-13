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

  it('exposes a button role and falls back to the title for its label', () => {
    render(<ListRow title="Notifications" onPress={() => {}} />)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeOnTheScreen()
  })

  it('prefers an explicit accessibilityLabel over the title', () => {
    render(
      <ListRow title="Notifications" accessibilityLabel="Open notifications" onPress={() => {}} />,
    )

    expect(screen.getByRole('button', { name: 'Open notifications' })).toBeOnTheScreen()
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

// An untrusted leading word must not be able to borrow the row's own words: it gets its own node,
// capped in width.
describe('ListRow titleActor', () => {
  it('renders the actor and the rest as separate nodes', () => {
    render(<ListRow titleActor="Marco " title="joined the trip" />)

    expect(screen.getByText('Marco')).toBeOnTheScreen()
    expect(screen.getByText('joined the trip')).toBeOnTheScreen()
  })

  // A notification names who acted AND what they did ("Léa joined as Léa"): on one line the second
  // half is the one cut, and it is the half that tells a wrong claim from a right one.
  it('lets the rest of the title wrap when asked, while the actor stays on one line', () => {
    render(<ListRow titleActor="Léa " title="joined as Léa" titleLines={2} />)

    expect(screen.getByText('joined as Léa')).toHaveProp('numberOfLines', 2)
    expect(screen.getByText('Léa')).toHaveProp('numberOfLines', 1)
  })

  it('keeps the title on one line by default', () => {
    render(<ListRow titleActor="Léa " title="joined as Léa" />)

    expect(screen.getByText('joined as Léa')).toHaveProp('numberOfLines', 1)
  })

  it('reads the actor out with the rest, since it is who the row is about', () => {
    render(<ListRow titleActor="Marco " title="joined the trip" onPress={() => {}} />)

    expect(screen.getByLabelText('Marco joined the trip')).toBeOnTheScreen()
  })

  it('keeps a single node when no actor is given', () => {
    render(<ListRow title="A member left the trip" />)

    expect(screen.getByText('A member left the trip')).toBeOnTheScreen()
  })
})
