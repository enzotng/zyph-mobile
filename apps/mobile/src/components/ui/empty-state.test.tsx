import { fireEvent, render, screen } from '@testing-library/react-native'

import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders title and body', () => {
    render(
      <EmptyState
        icon="airplane-outline"
        title="No trips yet"
        body="Start by creating your first trip."
      />,
    )

    expect(screen.getByText('No trips yet')).toBeOnTheScreen()
    expect(screen.getByText('Start by creating your first trip.')).toBeOnTheScreen()
  })

  it('does not render a CTA button when cta is not provided', () => {
    render(
      <EmptyState
        icon="airplane-outline"
        title="No trips yet"
        body="Start by creating your first trip."
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the CTA button when cta is provided', () => {
    render(
      <EmptyState
        icon="airplane-outline"
        title="No trips yet"
        body="Start by creating your first trip."
        cta="Create a trip"
        onCta={() => {}}
      />,
    )

    expect(screen.getByText('Create a trip')).toBeOnTheScreen()
  })

  it('calls onCta when the CTA button is pressed', () => {
    const onCta = jest.fn()

    render(
      <EmptyState
        icon="airplane-outline"
        title="No trips yet"
        body="Start by creating your first trip."
        cta="Create a trip"
        onCta={onCta}
      />,
    )

    fireEvent.press(screen.getByText('Create a trip'))
    expect(onCta).toHaveBeenCalledTimes(1)
  })
})
