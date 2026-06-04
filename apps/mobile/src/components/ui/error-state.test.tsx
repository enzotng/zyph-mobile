import { fireEvent, render, screen } from '@testing-library/react-native'

import { ErrorState } from './error-state'

describe('ErrorState', () => {
  it('renders title and body', () => {
    render(<ErrorState title="Something went wrong" body="The app hit a problem." />)

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen()
    expect(screen.getByText('The app hit a problem.')).toBeOnTheScreen()
  })

  it('does not render a retry button without retryLabel + onRetry', () => {
    render(<ErrorState title="Oops" body="Broken." />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the retry button and calls onRetry when pressed', () => {
    const onRetry = jest.fn()

    render(<ErrorState title="Oops" body="Broken." retryLabel="Try again" onRetry={onRetry} />)

    fireEvent.press(screen.getByText('Try again'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
