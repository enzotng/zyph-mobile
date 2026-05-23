import type { LatLng } from './coords'
import { bearing, haversine, relativeHeading } from './coords'

export type DevicePose = {
  heading: number
  pitch: number
}

export type Viewport = {
  width: number
  height: number
  hFovDeg?: number
  vFovDeg?: number
}

export type Projection = {
  visible: boolean
  x: number
  y: number
  scale: number
  delta: number
  distance: number
}

const DEFAULT_H_FOV = 60
const DEFAULT_V_FOV = 45
const MIN_SCALE = 0.35
const MAX_SCALE = 1.4
const SCALE_FALLOFF_M = 20

export function projectToScreen(
  user: LatLng,
  target: LatLng,
  pose: DevicePose,
  viewport: Viewport,
): Projection {
  const distance = haversine(user, target)
  const targetBearing = bearing(user, target)
  const delta = relativeHeading(targetBearing, pose.heading)

  const hFov = viewport.hFovDeg ?? DEFAULT_H_FOV
  const vFov = viewport.vFovDeg ?? DEFAULT_V_FOV

  const horizontalRatio = delta / (hFov / 2)
  const verticalRatio = -pose.pitch / (vFov / 2)

  const x = viewport.width / 2 + (viewport.width / 2) * horizontalRatio
  const y = viewport.height / 2 + (viewport.height / 2) * verticalRatio

  const visible = Math.abs(horizontalRatio) <= 1 && Math.abs(verticalRatio) <= 1

  const distanceScale = MAX_SCALE / (1 + distance / SCALE_FALLOFF_M)
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, distanceScale))

  return { visible, x, y, scale, delta, distance }
}
