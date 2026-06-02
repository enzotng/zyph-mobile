import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { Squircle } from './squircle'

describe('Squircle', () => {
  it('renders its children', () => {
    render(
      <Squircle>
        <Text>Inside the squircle</Text>
      </Squircle>,
    )

    expect(screen.getByText('Inside the squircle')).toBeOnTheScreen()
  })

  it('renders without a border when borderWidth is 0', () => {
    expect(() =>
      render(
        <Squircle borderWidth={0}>
          <Text>No border</Text>
        </Squircle>,
      ),
    ).not.toThrow()
  })
})
