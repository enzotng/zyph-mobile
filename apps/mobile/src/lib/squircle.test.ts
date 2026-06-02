import { squirclePoints } from './squircle'

describe('squirclePoints', () => {
  it('returns 4 corner arcs of (steps + 1) points each', () => {
    expect(squirclePoints(100, 100, 20, 5, 0, 10)).toHaveLength(44)
    expect(squirclePoints(100, 100, 20, 5, 0, 4)).toHaveLength(20)
  })

  it('starts on the left edge at the corner radius', () => {
    const [first] = squirclePoints(100, 100, 20)
    expect(first.x).toBeCloseTo(0)
    expect(first.y).toBeCloseTo(20)
  })

  it('keeps every point inside the box', () => {
    const points = squirclePoints(120, 80, 24)
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(120)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(80)
    }
  })

  it('clamps the radius to half the shortest side', () => {
    // radius 999 on a 100x60 box clamps to 30; the start point sits at y = 30.
    const [first] = squirclePoints(100, 60, 999)
    expect(first.y).toBeCloseTo(30)
  })

  it('applies the inset so a stroke is not clipped', () => {
    const [first] = squirclePoints(100, 100, 20, 5, 2)
    expect(first.x).toBeCloseTo(2)
  })

  it('supports per-corner radii (sharp bottom corners)', () => {
    const points = squirclePoints(100, 100, {
      topLeft: 20,
      topRight: 20,
      bottomRight: 0,
      bottomLeft: 0,
    })
    // Sharp corners land exactly on the box corners.
    expect(points).toContainEqual({ x: 100, y: 100 })
    expect(points).toContainEqual({ x: 0, y: 100 })
  })
})
