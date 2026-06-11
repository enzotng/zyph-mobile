import { render } from '@testing-library/react-native'

import { ArPath } from './ar-path'

// Smoke tests: the Skia canvas renders to nothing under the jest mock, so we only assert the
// component mounts across its states without throwing (perspective/animation are device-validated).
describe('ArPath', () => {
  const size = { width: 390, height: 844 }

  it('renders the ground trail toward an off-axis target', () => {
    expect(() => render(<ArPath {...size} delta={25} pitch={0.1} />)).not.toThrow()
  })

  it('renders the trail straight ahead', () => {
    expect(() => render(<ArPath {...size} delta={0} pitch={0} />)).not.toThrow()
  })

  it('renders nothing when the target is behind the user', () => {
    expect(() => render(<ArPath {...size} delta={160} pitch={0} />)).not.toThrow()
  })
})
