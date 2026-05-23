import { projectToScreen } from './projection'

const VIEWPORT = { width: 400, height: 800 }

describe('projectToScreen', () => {
  it('places a straight-ahead target at the screen center', () => {
    const user = { lat: 48.8566, lng: 2.3522 }
    const target = { lat: 49, lng: 2.3522 }
    const out = projectToScreen(user, target, { heading: 0, pitch: 0 }, VIEWPORT)
    expect(out.visible).toBe(true)
    expect(out.x).toBeCloseTo(200, 0)
    expect(out.y).toBeCloseTo(400, 0)
    expect(out.delta).toBeCloseTo(0, 1)
  })

  it('flags a target behind the user as not visible', () => {
    const user = { lat: 48.8566, lng: 2.3522 }
    const target = { lat: 48, lng: 2.3522 }
    const out = projectToScreen(user, target, { heading: 0, pitch: 0 }, VIEWPORT)
    expect(out.visible).toBe(false)
    expect(Math.abs(out.delta)).toBeGreaterThan(90)
  })

  it('decreases scale as the target moves away', () => {
    const user = { lat: 48.8566, lng: 2.3522 }
    const near = { lat: 48.857, lng: 2.3522 }
    const far = { lat: 50, lng: 2.3522 }
    const a = projectToScreen(user, near, { heading: 0, pitch: 0 }, VIEWPORT)
    const b = projectToScreen(user, far, { heading: 0, pitch: 0 }, VIEWPORT)
    expect(a.scale).toBeGreaterThan(b.scale)
  })

  it('shifts the projected point horizontally when target is to the right of heading', () => {
    const user = { lat: 48.8566, lng: 2.3522 }
    const east = { lat: 48.8566, lng: 2.4 }
    const out = projectToScreen(user, east, { heading: 60, pitch: 0 }, VIEWPORT)
    expect(out.x).toBeGreaterThan(200)
    expect(out.visible).toBe(true)
  })

  it('moves the projected point down when the user tilts the phone up', () => {
    const user = { lat: 48.8566, lng: 2.3522 }
    const target = { lat: 49, lng: 2.3522 }
    const tiltedUp = projectToScreen(user, target, { heading: 0, pitch: 0.3 }, VIEWPORT)
    expect(tiltedUp.y).toBeLessThan(400)
  })
})
