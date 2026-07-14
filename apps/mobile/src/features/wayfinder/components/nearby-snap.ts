// Snap geometry + landing logic for the map's Nearby sheet. Kept pure and separate from the
// component: RNTL computes no pixel layout, so this module is the only part of the sheet a test
// can actually assert on.

export type SnapPoint = 'docked' | 'mid' | 'expanded'
export type SnapHeights = Record<SnapPoint, number>

// Ordered low to high, so a fling is just a step along this list.
export const SNAP_ORDER: readonly SnapPoint[] = ['docked', 'mid', 'expanded'] as const

// Docked shows the grabber, the title and the live badge - nothing else.
export const DOCKED_HEIGHT = 96

// Past this vertical speed (px/s) the gesture reads as a fling: honour the direction rather than
// the distance, so a short flick still moves a snap.
const FLING_VELOCITY = 500

export function snapHeights(screenHeight: number): SnapHeights {
  return {
    docked: DOCKED_HEIGHT,
    mid: Math.round(screenHeight * 0.45),
    expanded: Math.round(screenHeight * 0.85),
  }
}

// Where the sheet lands when the finger lifts. `height` is the live height at release (the drag is
// already applied); `velocityY` is negative upward, which grows the sheet.
export function resolveSnap(
  height: number,
  velocityY: number,
  heights: SnapHeights,
  from: SnapPoint,
): SnapPoint {
  const fromIndex = SNAP_ORDER.indexOf(from)

  if (velocityY < -FLING_VELOCITY) {
    return SNAP_ORDER[Math.min(fromIndex + 1, SNAP_ORDER.length - 1)] as SnapPoint
  }
  if (velocityY > FLING_VELOCITY) {
    return SNAP_ORDER[Math.max(fromIndex - 1, 0)] as SnapPoint
  }

  let nearest: SnapPoint = SNAP_ORDER[0] as SnapPoint
  let shortest = Number.POSITIVE_INFINITY
  for (const snap of SNAP_ORDER) {
    const distance = Math.abs(heights[snap] - height)
    if (distance < shortest) {
      shortest = distance
      nearest = snap
    }
  }
  return nearest
}

// Tapping the header steps up, and wraps back to docked from the top.
export function nextSnap(from: SnapPoint): SnapPoint {
  const index = SNAP_ORDER.indexOf(from)
  if (index === SNAP_ORDER.length - 1) {
    return SNAP_ORDER[0] as SnapPoint
  }
  return SNAP_ORDER[index + 1] as SnapPoint
}
