import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { AppHeader } from './app-header'

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), canGoBack: jest.fn(() => true) }
  return { useRouter: () => router, __router: router }
})

type RouterMock = { back: jest.Mock; canGoBack: jest.Mock }
type ExpoRouterMock = { __router: RouterMock }

function router(): RouterMock {
  return (jest.requireMock('expo-router') as ExpoRouterMock).__router
}

describe('AppHeader', () => {
  beforeEach(() => {
    router().back.mockReset()
    router().canGoBack.mockReset()
    router().canGoBack.mockReturnValue(true)
  })

  it('renders the title', () => {
    render(<AppHeader title="My Trip" />)

    expect(screen.getByText('My Trip')).toBeOnTheScreen()
  })

  it('renders an empty title when no title prop is given', () => {
    render(<AppHeader />)

    expect(screen.getByText('')).toBeOnTheScreen()
  })

  it('shows the back button when canGoBack returns true', () => {
    router().canGoBack.mockReturnValue(true)
    render(<AppHeader title="Back Test" />)

    expect(screen.getByRole('button', { name: 'Go back' })).toBeOnTheScreen()
  })

  it('hides the back button when canGoBack returns false', () => {
    router().canGoBack.mockReturnValue(false)
    render(<AppHeader title="No Back" />)

    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull()
  })

  it('shows the back button when showBack=true regardless of canGoBack', () => {
    router().canGoBack.mockReturnValue(false)
    render(<AppHeader title="Forced Back" showBack={true} />)

    expect(screen.getByRole('button', { name: 'Go back' })).toBeOnTheScreen()
  })

  it('hides the back button when showBack=false regardless of canGoBack', () => {
    router().canGoBack.mockReturnValue(true)
    render(<AppHeader title="No Back Forced" showBack={false} />)

    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull()
  })

  it('calls router.back when the back button is pressed', () => {
    router().canGoBack.mockReturnValue(true)
    render(<AppHeader title="Press Back" />)

    fireEvent.press(screen.getByRole('button', { name: 'Go back' }))

    expect(router().back).toHaveBeenCalledTimes(1)
  })

  it('renders the right slot when provided', () => {
    render(<AppHeader title="With Right" right={<Text>Right Content</Text>} />)

    expect(screen.getByText('Right Content')).toBeOnTheScreen()
  })

  it('does not render a right slot element when not provided', () => {
    render(<AppHeader title="No Right" />)

    expect(screen.queryByText('Right Content')).toBeNull()
  })
})
