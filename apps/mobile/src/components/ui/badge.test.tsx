import { render, screen } from '@testing-library/react-native'

import { Badge } from './badge'

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge label="New" />)

    expect(screen.getByText('New')).toBeOnTheScreen()
  })

  it('renders every tone without throwing', () => {
    const tones = ['primary', 'success', 'warning', 'destructive', 'muted', 'accent'] as const

    for (const tone of tones) {
      expect(() => render(<Badge label="Test" tone={tone} />)).not.toThrow()
    }
  })

  it('renders solid variant without throwing', () => {
    expect(() => render(<Badge label="Solid" tone="primary" solid />)).not.toThrow()
  })

  it('renders every tone as solid without throwing', () => {
    const tones = ['primary', 'success', 'warning', 'destructive', 'muted', 'accent'] as const

    for (const tone of tones) {
      expect(() => render(<Badge label="Solid" tone={tone} solid />)).not.toThrow()
    }
  })

  it('renders with an icon without throwing', () => {
    expect(() => render(<Badge label="With icon" icon="star" />)).not.toThrow()
  })
})
