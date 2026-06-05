import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import { HomeHeader } from './home-header'

// expo-image renders to this host component under jest-expo (matches city-image.test.tsx).
const EXPO_IMAGE_TYPE = 'ViewManagerAdapter_ExpoImage'

function hasNodeOfType(node: ReactTestRendererJSON | null, type: string): boolean {
  if (!node) {
    return false
  }
  if (node.type === type) {
    return true
  }
  return (node.children ?? []).some((child) =>
    typeof child === 'string' ? false : hasNodeOfType(child, type),
  )
}

function renderedHasImage(): boolean {
  return hasNodeOfType(screen.toJSON() as ReactTestRendererJSON | null, EXPO_IMAGE_TYPE)
}

describe('HomeHeader', () => {
  it('renders the greeting and subtitle', () => {
    render(<HomeHeader greeting="Hello, Alice" subtitle="2 trips" onAvatarPress={() => {}} />)

    expect(screen.getByText('Hello, Alice')).toBeOnTheScreen()
    expect(screen.getByText('2 trips')).toBeOnTheScreen()
  })

  it('derives the avatar initial from avatarName', () => {
    render(
      <HomeHeader
        greeting="Hello"
        subtitle="No trips yet"
        avatarName="Bob"
        onAvatarPress={() => {}}
      />,
    )

    expect(screen.getByText('B')).toBeOnTheScreen()
  })

  it('falls back to "?" avatar when no avatarName is provided', () => {
    render(<HomeHeader greeting="Hi" subtitle="Welcome" onAvatarPress={() => {}} />)

    expect(screen.getByText('?')).toBeOnTheScreen()
  })

  it('renders the avatar photo when an avatarUrl is provided', () => {
    render(
      <HomeHeader
        greeting="Hi"
        subtitle="Welcome"
        avatarName="Carol"
        avatarUrl="https://example.com/avatar.png"
        onAvatarPress={() => {}}
      />,
    )

    // With a photo URL the Avatar renders the expo-image overlay on top of the initial.
    expect(renderedHasImage()).toBe(true)
  })

  it('shows the initials fallback and no photo when avatarUrl is null', () => {
    render(
      <HomeHeader
        greeting="Hi"
        subtitle="Welcome"
        avatarName="Dave"
        avatarUrl={null}
        onAvatarPress={() => {}}
      />,
    )

    // No image node; only the coloured initial derived from the name is shown.
    expect(renderedHasImage()).toBe(false)
    expect(screen.getByText('D')).toBeOnTheScreen()
  })

  it('calls onAvatarPress when the avatar button is pressed', () => {
    const onAvatarPress = jest.fn()
    render(<HomeHeader greeting="Hi" subtitle="Welcome" onAvatarPress={onAvatarPress} />)

    fireEvent.press(screen.getByRole('button'))

    expect(onAvatarPress).toHaveBeenCalledTimes(1)
  })
})
