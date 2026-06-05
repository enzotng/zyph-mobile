import { render } from '@testing-library/react-native'

import { Skeleton } from './skeleton'

function flatStyle(node: { props: { style?: unknown } }) {
  const style = node.props.style
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]))
}

describe('Skeleton', () => {
  it('renders with the default full width and falls back to the small radius', () => {
    const { toJSON } = render(<Skeleton />)
    const style = flatStyle(toJSON() as { props: { style?: unknown } })
    expect(style.width).toBe('100%')
    expect(style.height).toBe(16)
    expect(style.borderRadius).toBeGreaterThan(0)
  })

  it('applies an explicit width, height and radius', () => {
    const { toJSON } = render(<Skeleton width={120} height={40} radius={12} />)
    const style = flatStyle(toJSON() as { props: { style?: unknown } })
    expect(style.width).toBe(120)
    expect(style.height).toBe(40)
    expect(style.borderRadius).toBe(12)
  })
})
