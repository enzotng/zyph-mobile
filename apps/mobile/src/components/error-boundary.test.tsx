import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { ErrorBoundary } from './error-boundary'

function Boom(): never {
  throw new Error('boom')
}

// Throws on its first render only, then renders safe content. Lets us verify
// that resetting the boundary re-renders children instead of the fallback.
function ThrowOnce({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
  if (shouldThrow) {
    throw new Error('boom')
  }
  return <Text>Recovered content</Text>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Text>Safe content</Text>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Safe content')).toBeOnTheScreen()
  })

  it('renders the fallback error state when a child throws', () => {
    // React logs the caught error; silence it to keep the test output clean.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    // i18n is initialized in jest-setup with 'en'.
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen()
    expect(screen.getByText('The app hit an unexpected problem. Try again.')).toBeOnTheScreen()
    expect(screen.getByText('Try again')).toBeOnTheScreen()

    spy.mockRestore()
  })

  it('clears the error and re-renders children when retry is pressed', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowOnce shouldThrow={true} />
      </ErrorBoundary>,
    )

    // Fallback is shown after the child throws.
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen()

    // Stop throwing so the next render can succeed, then trigger reset().
    rerender(
      <ErrorBoundary>
        <ThrowOnce shouldThrow={false} />
      </ErrorBoundary>,
    )
    fireEvent.press(screen.getByText('Try again'))

    expect(screen.getByText('Recovered content')).toBeOnTheScreen()
    expect(screen.queryByText('Something went wrong')).toBeNull()

    spy.mockRestore()
  })
})
