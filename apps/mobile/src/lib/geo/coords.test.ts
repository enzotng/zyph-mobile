import { bearing, haversine, relativeHeading } from './coords'

const PARIS = { lat: 48.8566, lng: 2.3522 }
const LONDON = { lat: 51.5074, lng: -0.1278 }
const NEW_YORK = { lat: 40.7128, lng: -74.006 }

describe('haversine', () => {
  it('returns 0 for the same point', () => {
    expect(haversine(PARIS, PARIS)).toBe(0)
  })

  it('matches the known Paris-London distance within 1 km', () => {
    expect(haversine(PARIS, LONDON)).toBeGreaterThan(343_000)
    expect(haversine(PARIS, LONDON)).toBeLessThan(345_000)
  })

  it('is symmetric', () => {
    expect(haversine(PARIS, LONDON)).toBeCloseTo(haversine(LONDON, PARIS), 6)
  })

  it('handles small distances under 100 m', () => {
    const a = { lat: 48.8566, lng: 2.3522 }
    const b = { lat: 48.857, lng: 2.3526 }
    const d = haversine(a, b)
    expect(d).toBeGreaterThan(40)
    expect(d).toBeLessThan(70)
  })
})

describe('bearing', () => {
  it('returns ~90 (East) when target is due east', () => {
    const here = { lat: 48.8566, lng: 2.3522 }
    const east = { lat: 48.8566, lng: 2.4 }
    expect(bearing(here, east)).toBeGreaterThan(89)
    expect(bearing(here, east)).toBeLessThan(91)
  })

  it('returns ~0 (North) when target is due north', () => {
    const here = { lat: 48.8566, lng: 2.3522 }
    const north = { lat: 49, lng: 2.3522 }
    expect(bearing(here, north)).toBeLessThan(1)
  })

  it('returns ~270 (West) when target is due west', () => {
    const here = { lat: 48.8566, lng: 2.3522 }
    const west = { lat: 48.8566, lng: 2.0 }
    expect(bearing(here, west)).toBeGreaterThan(269)
    expect(bearing(here, west)).toBeLessThan(271)
  })

  it('returns Paris->NY bearing close to known value (~292)', () => {
    expect(bearing(PARIS, NEW_YORK)).toBeGreaterThan(290)
    expect(bearing(PARIS, NEW_YORK)).toBeLessThan(295)
  })

  it('always returns a value in [0, 360)', () => {
    expect(bearing(NEW_YORK, PARIS)).toBeGreaterThanOrEqual(0)
    expect(bearing(NEW_YORK, PARIS)).toBeLessThan(360)
  })
})

describe('relativeHeading', () => {
  it('returns 0 when device faces the target', () => {
    expect(relativeHeading(90, 90)).toBe(0)
  })

  it('returns a positive delta when target is to the right', () => {
    expect(relativeHeading(120, 90)).toBe(30)
  })

  it('returns a negative delta when target is to the left', () => {
    expect(relativeHeading(60, 90)).toBe(-30)
  })

  it('wraps around the 0/360 boundary (target north, facing 350)', () => {
    expect(relativeHeading(10, 350)).toBe(20)
  })

  it('wraps around the 0/360 boundary (target 350, facing 10)', () => {
    expect(relativeHeading(350, 10)).toBe(-20)
  })

  it('returns 180 when target is exactly behind', () => {
    expect(Math.abs(relativeHeading(270, 90))).toBe(180)
  })
})
