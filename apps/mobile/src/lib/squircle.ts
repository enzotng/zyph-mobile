export type Point = { x: number; y: number }
export type CornerRadii = {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

// Ordered outline points of a squircle: a rounded rectangle whose corners follow a
// superellipse (the iOS "continuous" corner, but pronounced). `smoothing` is the
// superellipse exponent (higher -> straighter edges; ~5 reads as the iOS squircle).
// `inset` shrinks the rect symmetrically - pass borderWidth/2 so a stroke is not clipped.
// `radius` is a single value for all corners, or a per-corner object (a 0 corner is sharp).
// Consecutive points are joined by straight lines, so the four arcs draw the edges too.
export function squirclePoints(
  width: number,
  height: number,
  radius: number | Partial<CornerRadii>,
  smoothing = 5,
  inset = 0,
  steps = 10,
): Point[] {
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const w = Math.max(0, right - left)
  const h = Math.max(0, bottom - top)
  const maxRadius = Math.min(w, h) / 2
  const clamp = (value: number) => Math.max(0, Math.min(value, maxRadius))

  const radii: CornerRadii =
    typeof radius === 'number'
      ? {
          topLeft: clamp(radius),
          topRight: clamp(radius),
          bottomRight: clamp(radius),
          bottomLeft: clamp(radius),
        }
      : {
          topLeft: clamp(radius.topLeft ?? 0),
          topRight: clamp(radius.topRight ?? 0),
          bottomRight: clamp(radius.bottomRight ?? 0),
          bottomLeft: clamp(radius.bottomLeft ?? 0),
        }

  const e = 2 / smoothing
  const points: Point[] = []

  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * (Math.PI / 2)
    const r = radii.topLeft
    points.push({ x: left + r - r * Math.cos(t) ** e, y: top + r - r * Math.sin(t) ** e })
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * (Math.PI / 2)
    const r = radii.topRight
    points.push({ x: right - r + r * Math.sin(t) ** e, y: top + r - r * Math.cos(t) ** e })
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * (Math.PI / 2)
    const r = radii.bottomRight
    points.push({ x: right - r + r * Math.cos(t) ** e, y: bottom - r + r * Math.sin(t) ** e })
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * (Math.PI / 2)
    const r = radii.bottomLeft
    points.push({ x: left + r - r * Math.sin(t) ** e, y: bottom - r + r * Math.cos(t) ** e })
  }

  return points
}
