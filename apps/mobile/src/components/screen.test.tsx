import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { Screen } from './screen'

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), canGoBack: jest.fn(() => false) }
  return { useRouter: () => router, __router: router }
})

type RouterMock = { back: jest.Mock; canGoBack: jest.Mock }
type ExpoRouterMock = { __router: RouterMock }

function router(): RouterMock {
  return (jest.requireMock('expo-router') as ExpoRouterMock).__router
}

describe('Screen', () => {
  beforeEach(() => {
    router().back.mockReset()
    router().canGoBack.mockReset()
    router().canGoBack.mockReturnValue(false)
  })

  it('renders children without scroll', () => {
    render(
      <Screen>
        <Text>Child Content</Text>
      </Screen>,
    )

    expect(screen.getByText('Child Content')).toBeOnTheScreen()
  })

  it('renders children with scroll=true', () => {
    render(
      <Screen scroll>
        <Text>Scrollable Child</Text>
      </Screen>,
    )

    expect(screen.getByText('Scrollable Child')).toBeOnTheScreen()
  })

  it('renders the AppHeader with the given title', () => {
    render(
      <Screen title="Trip Details">
        <Text>Content</Text>
      </Screen>,
    )

    expect(screen.getByText('Trip Details')).toBeOnTheScreen()
  })

  it('shows the back button in the header when showBack=true', () => {
    router().canGoBack.mockReturnValue(false)
    render(
      <Screen title="Back Screen" showBack={true}>
        <Text>Content</Text>
      </Screen>,
    )

    expect(screen.getByRole('button', { name: 'Go back' })).toBeOnTheScreen()
  })

  it('renders the right slot in the header', () => {
    render(
      <Screen title="With Right" right={<Text>Action</Text>}>
        <Text>Content</Text>
      </Screen>,
    )

    expect(screen.getByText('Action')).toBeOnTheScreen()
  })

  it('renders both header and children simultaneously', () => {
    render(
      <Screen title="Overview">
        <Text>Body Text</Text>
      </Screen>,
    )

    expect(screen.getByText('Overview')).toBeOnTheScreen()
    expect(screen.getByText('Body Text')).toBeOnTheScreen()
  })

  it('defaults scroll to false and still renders children', () => {
    render(
      <Screen>
        <Text>No Scroll</Text>
      </Screen>,
    )

    expect(screen.getByText('No Scroll')).toBeOnTheScreen()
  })
})
