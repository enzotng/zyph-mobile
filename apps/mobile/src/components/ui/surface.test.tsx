import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { Surface } from './surface'

describe('Surface', () => {
  it('renders its children', () => {
    render(
      <Surface>
        <Text>Inside the surface</Text>
      </Surface>,
    )

    expect(screen.getByText('Inside the surface')).toBeOnTheScreen()
  })

  it('renders without a border when borderWidth is 0', () => {
    expect(() =>
      render(
        <Surface borderWidth={0}>
          <Text>No border</Text>
        </Surface>,
      ),
    ).not.toThrow()
  })
})
