import { DOCKED_HEIGHT, nextSnap, resolveSnap, type SnapHeights, snapHeights } from './nearby-snap'

const heights: SnapHeights = snapHeights(800) // docked 96, mid 360, expanded 680

describe('snapHeights', () => {
  it('derives mid and expanded from the screen height', () => {
    expect(heights).toEqual({ docked: DOCKED_HEIGHT, mid: 360, expanded: 680 })
  })
})

describe('resolveSnap', () => {
  it('lands on the nearest snap when the finger is slow', () => {
    expect(resolveSnap(340, 0, heights, 'docked')).toBe('mid')
    expect(resolveSnap(150, 0, heights, 'mid')).toBe('docked')
    expect(resolveSnap(640, 0, heights, 'mid')).toBe('expanded')
  })

  it('follows an upward fling one snap up, whatever the distance dragged', () => {
    // Barely moved, but flung hard upward (negative velocity grows the sheet).
    expect(resolveSnap(110, -900, heights, 'docked')).toBe('mid')
    expect(resolveSnap(370, -900, heights, 'mid')).toBe('expanded')
  })

  it('follows a downward fling one snap down', () => {
    expect(resolveSnap(670, 900, heights, 'expanded')).toBe('mid')
    expect(resolveSnap(350, 900, heights, 'mid')).toBe('docked')
  })

  it('clamps a fling at either end instead of overshooting', () => {
    expect(resolveSnap(680, -900, heights, 'expanded')).toBe('expanded')
    expect(resolveSnap(96, 900, heights, 'docked')).toBe('docked')
  })
})

describe('nextSnap', () => {
  it('advances one snap and wraps from expanded back to docked', () => {
    expect(nextSnap('docked')).toBe('mid')
    expect(nextSnap('mid')).toBe('expanded')
    expect(nextSnap('expanded')).toBe('docked')
  })
})
