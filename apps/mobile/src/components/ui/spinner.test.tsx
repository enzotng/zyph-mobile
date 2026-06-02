import { render, screen } from '@testing-library/react-native'

import { Spinner } from './spinner'

describe('Spinner', () => {
  it('renders without throwing', () => {
    expect(() => render(<Spinner />)).not.toThrow()
  })

  it('renders the label when provided', () => {
    render(<Spinner label="Loading..." />)

    expect(screen.getByText('Loading...')).toBeOnTheScreen()
  })

  it('does not render a label when omitted', () => {
    render(<Spinner />)

    expect(screen.queryByText('Loading...')).toBeNull()
  })
})
