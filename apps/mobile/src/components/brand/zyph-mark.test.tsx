import { render } from '@testing-library/react-native'

import { ZyphMark } from './zyph-mark'

describe('ZyphMark', () => {
  it('renders without crashing', () => {
    expect(() => render(<ZyphMark />)).not.toThrow()
  })

  it('accepts a custom size and color', () => {
    expect(() => render(<ZyphMark size={64} color="#38BDF8" />)).not.toThrow()
  })
})
