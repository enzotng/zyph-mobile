import { render, screen } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

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

    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen()
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

  it('renders the footer alongside the children when footer is provided', () => {
    render(
      <Screen title="With Footer" footer={<Text>Footer Action</Text>}>
        <Text>Body</Text>
      </Screen>,
    )

    expect(screen.getByText('Footer Action')).toBeOnTheScreen()
    expect(screen.getByText('Body')).toBeOnTheScreen()
    expect(screen.getByText('With Footer')).toBeOnTheScreen()
  })

  it('renders the footer with scroll=true (sticky footer over scrollable body)', () => {
    render(
      <Screen scroll footer={<Text>Sticky Footer</Text>}>
        <Text>Scrollable Body</Text>
      </Screen>,
    )

    expect(screen.getByText('Sticky Footer')).toBeOnTheScreen()
    expect(screen.getByText('Scrollable Body')).toBeOnTheScreen()
  })

  it('does not render a footer when footer is not provided', () => {
    render(
      <Screen title="No Footer">
        <Text>Body Only</Text>
      </Screen>,
    )

    expect(screen.queryByText('Footer Action')).toBeNull()
  })

  describe('on Android', () => {
    const originalOS = Platform.OS

    beforeAll(() => {
      Platform.OS = 'android'
    })

    afterAll(() => {
      Platform.OS = originalOS
    })

    it('renders the footer with no keyboard padding behavior on Android', () => {
      render(
        <Screen title="Android Footer" footer={<Text>Android Action</Text>}>
          <Text>Android Body</Text>
        </Screen>,
      )

      expect(screen.getByText('Android Action')).toBeOnTheScreen()
      expect(screen.getByText('Android Body')).toBeOnTheScreen()
    })
  })
})
