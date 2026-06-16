import { render } from '@testing-library/react-native'

import { ArArrow } from './ar-arrow'

// Smoke tests: the Skia canvas renders to nothing under the jest mock, so we only assert the
// component mounts across its states without throwing (geometry/animation are device-validated).
describe('ArArrow', () => {
  const size = { width: 390, height: 844 }

  it('renders the directional arrow toward an off-axis target', () => {
    expect(() => render(<ArArrow {...size} delta={28} pitch={0.1} distance={250} />)).not.toThrow()
  })

  it('renders the aligned (on-target) state when pointing straight ahead', () => {
    expect(() => render(<ArArrow {...size} delta={2} pitch={0} distance={120} />)).not.toThrow()
  })

  it('renders the arrival sonar when within the arrival radius', () => {
    expect(() => render(<ArArrow {...size} delta={0} pitch={0} distance={8} />)).not.toThrow()
  })

  it('renders while GPS distance is still unknown', () => {
    expect(() =>
      render(<ArArrow {...size} delta={140} pitch={-0.3} distance={null} />),
    ).not.toThrow()
  })
})
