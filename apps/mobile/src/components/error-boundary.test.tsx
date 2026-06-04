import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { ErrorBoundary } from './error-boundary'

function Boom(): never {
  throw new Error('boom')
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

    spy.mockRestore()
  })
})
