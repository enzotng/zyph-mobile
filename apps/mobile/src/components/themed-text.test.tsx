import { render, screen } from '@testing-library/react-native'

import { ThemedText } from './themed-text'

describe('ThemedText', () => {
  it('renders its children', () => {
    render(<ThemedText>Hello ZYPH</ThemedText>)

    expect(screen.getByText('Hello ZYPH')).toBeOnTheScreen()
  })

  it('renders the title variant', () => {
    render(<ThemedText type="title">Trips</ThemedText>)

    expect(screen.getByText('Trips')).toBeOnTheScreen()
  })
})
