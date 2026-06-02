import { render, screen } from '@testing-library/react-native'

import { Avatar, AvatarStack } from './avatar'

describe('Avatar', () => {
  it('shows the initial derived from name', () => {
    render(<Avatar name="Alice" />)

    expect(screen.getByText('A')).toBeOnTheScreen()
  })

  it('shows an explicit initial when provided', () => {
    render(<Avatar initial="Z" />)

    expect(screen.getByText('Z')).toBeOnTheScreen()
  })

  it('shows "?" when no name or initial is given', () => {
    render(<Avatar />)

    expect(screen.getByText('?')).toBeOnTheScreen()
  })

  it('renders with ring prop without throwing', () => {
    expect(() => render(<Avatar name="Bob" ring size={40} />)).not.toThrow()
  })
})

describe('AvatarStack', () => {
  const members = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Carol' },
    { id: '4', name: 'David' },
    { id: '5', name: 'Eve' },
    { id: '6', name: 'Frank' },
  ]

  it('shows "+2" overflow when 6 members with max 4', () => {
    render(<AvatarStack members={members} max={4} />)

    expect(screen.getByText('+2')).toBeOnTheScreen()
  })

  it('shows only visible initials when within max', () => {
    render(<AvatarStack members={members.slice(0, 3)} max={4} />)

    expect(screen.getByText('A')).toBeOnTheScreen()
    expect(screen.getByText('B')).toBeOnTheScreen()
    expect(screen.getByText('C')).toBeOnTheScreen()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  it('renders without throwing with default props', () => {
    expect(() => render(<AvatarStack members={members} />)).not.toThrow()
  })
})
