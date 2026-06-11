import { Canvas, Path, processTransform3d, Skia, type SkPath } from '@shopify/react-native-skia'
import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'

type Props = {
  width: number
  height: number
  /** Relative heading to the target in degrees; 0 = straight ahead, +right / -left. */
  delta: number
  /** Device pitch (radians) from DeviceMotion; modulates the ground lay-down angle. */
  pitch: number
}

// Number of chevrons in the receding trail.
const CHEVRONS = 6
// Lay the trail onto the ground plane (radians).
const GROUND_TILT = (Math.PI / 180) * 62
// One breathing cycle (ms) for the whole trail.
const PULSE_MS = 1600
// Hide the trail when the target is roughly behind the user (the arrow's "turn around" covers it).
const BEHIND_DEG = 100

// #rrggbb -> rgba() with alpha; falls back to a safe indigo for any non-hex token.
function hexToRgba(hex: string, alpha: number): string {
  if (hex[0] !== '#' || (hex.length !== 7 && hex.length !== 9)) {
    return `rgba(99,102,241,${alpha})`
  }
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// A "^" chevron pointing -Y (forward), centred on x=0 at local row yc, stroked at render time.
function buildChevron(yc: number, halfW: number, h: number): SkPath {
  const p = Skia.Path.Make()
  p.moveTo(-halfW, yc + h)
  p.lineTo(0, yc)
  p.lineTo(halfW, yc + h)
  return p
}

export function ArPath({ width, height, delta, pitch }: Props) {
  const { theme } = useUnistyles()
  const behind = Math.abs(delta) > BEHIND_DEG

  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS }), -1, false)
    return () => {
      cancelAnimation(pulse)
    }
  }, [pulse])
  // Subtle global breathing reused across every chevron (one derived value, no per-row hook).
  const flow = useDerivedValue(() => 0.6 + 0.4 * Math.sin(pulse.value * Math.PI * 2))

  const base = Math.min(width, height)
  const cx = width / 2
  const cy = height / 2

  // Build each chevron at an increasing -Y offset so the shared 3D transform spreads them into
  // the distance; bake a depth fade + size taper into each row.
  const rows = useMemo(() => {
    const clampedPitch = Math.max(-0.5, Math.min(0.5, pitch))
    const matrix = processTransform3d([
      { translate: [cx, cy + base * 0.2] },
      { perspective: base * 1.5 },
      { rotateX: GROUND_TILT + clampedPitch * 0.4 },
      { rotateZ: (delta * Math.PI) / 180 },
    ])
    const near = base * 0.02
    const spacing = base * 0.07
    return Array.from({ length: CHEVRONS }, (_, i) => {
      const taper = 1 - i * 0.1
      const yc = -(near + i * spacing)
      const path = buildChevron(yc, base * 0.07 * taper, base * 0.05 * taper)
      path.transform(matrix)
      return {
        path,
        color: hexToRgba(theme.colors.primary, 0.92 - i * 0.13),
        strokeWidth: base * 0.02 * taper,
      }
    })
  }, [cx, cy, base, pitch, delta, theme.colors.primary])

  if (behind) {
    return null
  }

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Canvas style={{ width, height }}>
        {rows.map((row, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable trail rows
            key={i}
            path={row.path}
            color={row.color}
            opacity={flow}
            style="stroke"
            strokeWidth={row.strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
      </Canvas>
    </View>
  )
}
