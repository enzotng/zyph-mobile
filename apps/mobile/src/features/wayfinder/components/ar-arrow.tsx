import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  processTransform3d,
  Skia,
  type SkPath,
  vec,
} from '@shopify/react-native-skia'
import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

type Props = {
  width: number
  height: number
  /** Relative heading to the target in degrees; 0 = straight ahead, +right / -left. */
  delta: number
  /** Device pitch (radians) from DeviceMotion; modulates the ground lay-down angle. */
  pitch: number
  /** Great-circle distance to the target in metres, or null while GPS is acquiring. */
  distance: number | null
}

// Within this many degrees of the target we treat the phone as pointing at it (arrow turns green).
const ALIGNED_DEG = 8
// Inside this radius (metres) the target is reached - switch to the arrival sonar.
export const ARRIVAL_RADIUS_M = 15
// Base lay-down angle (radians) tipping the arrow from facing-camera onto the ground plane.
const GROUND_TILT = (Math.PI / 180) * 60
// One pulse cycle (ms) for the glow and the arrival sonar.
const PULSE_MS = 1400

// Blend two #rrggbb colours; t=0 -> a, t=1 -> b. Lets us derive a lighter tip highlight
// straight from the theme token without extra colour constants. Falls back to `a` for any
// non-hex input so a future theme token format (rgb()/hsl()) can never feed Skia a bad colour.
function mixHex(a: string, b: string, t: number): string {
  if (a[0] !== '#' || (a.length !== 7 && a.length !== 9) || b[0] !== '#') {
    return a
  }
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16))
  const mixed = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// Closer target -> bigger arrow. Maps distance (m) to a scale, clamped so it never vanishes
// nor fills the screen.
function proximityScale(distance: number | null): number {
  if (distance == null) {
    return 1
  }
  const clamped = Math.max(ARRIVAL_RADIUS_M, Math.min(400, distance))
  const far = (clamped - ARRIVAL_RADIUS_M) / (400 - ARRIVAL_RADIUS_M)
  return 1.18 - far * 0.5
}

// A chevron arrow centred on the origin, tip toward -Y (screen up) before the 3D transform.
function buildArrow(len: number, halfW: number): SkPath {
  const p = Skia.Path.Make()
  p.moveTo(0, -len)
  p.lineTo(halfW, len * 0.12)
  p.lineTo(halfW * 0.4, len * 0.12)
  p.lineTo(halfW * 0.4, len * 0.7)
  p.lineTo(-halfW * 0.4, len * 0.7)
  p.lineTo(-halfW * 0.4, len * 0.12)
  p.lineTo(-halfW, len * 0.12)
  p.close()
  return p
}

// A check mark centred on (cx, cy), stroked - the "you arrived" glyph inside the sonar.
function buildCheck(cx: number, cy: number, s: number): SkPath {
  const p = Skia.Path.Make()
  p.moveTo(cx - s, cy)
  p.lineTo(cx - s * 0.2, cy + s * 0.85)
  p.lineTo(cx + s, cy - s * 0.7)
  return p
}

export function ArArrow({ width, height, delta, pitch, distance }: Props) {
  const { theme } = useUnistyles()
  const aligned = Math.abs(delta) <= ALIGNED_DEG
  const arrived = distance != null && distance <= ARRIVAL_RADIUS_M

  // Continuous 0..1 pulse driving both the glow opacity and the arrival sonar (UI thread).
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS }), -1, false)
    // Stop the infinite loop when the AR screen unmounts so it does not keep running on the UI
    // thread against a detached shared value.
    return () => {
      cancelAnimation(pulse)
    }
  }, [pulse])

  const base = Math.min(width, height)
  const cx = width / 2
  const cy = height / 2

  const tint = arrived || aligned ? theme.colors.success : theme.colors.primary
  const highlight = mixHex(tint, '#ffffff', 0.45)

  // Arrow geometry, recomputed per render: delta/pitch update at sensor rate, so memoisation
  // mostly structures the work rather than skipping it.
  const scale = proximityScale(distance)
  const len = base * 0.17 * scale
  const halfW = base * 0.09 * scale
  const arrowPath = useMemo(() => {
    const p = buildArrow(len, halfW)
    const clampedPitch = Math.max(-0.5, Math.min(0.5, pitch))
    p.transform(
      processTransform3d([
        { translate: [cx, cy + base * 0.04] },
        { perspective: base * 1.7 },
        { rotateX: GROUND_TILT + clampedPitch * 0.45 },
        { rotateZ: (delta * Math.PI) / 180 },
      ]),
    )
    return p
  }, [len, halfW, cx, cy, base, pitch, delta])

  const glowOpacity = useDerivedValue(() => 0.25 + pulse.value * 0.4)

  // Arrival sonar: two stroked rings expanding out of phase, fading as they grow.
  const ringMax = base * 0.34
  const ringStart = base * 0.12
  const ringR1 = useDerivedValue(() => ringStart + pulse.value * ringMax)
  const ringR2 = useDerivedValue(() => ringStart + ((pulse.value + 0.5) % 1) * ringMax)
  const ringO1 = useDerivedValue(() => 0.7 * (1 - pulse.value))
  const ringO2 = useDerivedValue(() => 0.7 * (1 - ((pulse.value + 0.5) % 1)))
  const checkPath = useMemo(() => buildCheck(cx, cy, base * 0.05), [cx, cy, base])

  return (
    <View pointerEvents="none" style={[styles.root, { width, height }]}>
      <Canvas style={{ width, height }}>
        {arrived ? (
          <Group>
            <Circle
              cx={cx}
              cy={cy}
              r={ringR1}
              opacity={ringO1}
              color={theme.colors.success}
              style="stroke"
              strokeWidth={base * 0.012}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={ringR2}
              opacity={ringO2}
              color={theme.colors.success}
              style="stroke"
              strokeWidth={base * 0.012}
            />
            <Circle cx={cx} cy={cy} r={base * 0.1} color={theme.colors.success} />
            <Path
              path={checkPath}
              color={theme.colors.primaryForeground}
              style="stroke"
              strokeWidth={base * 0.018}
              strokeCap="round"
              strokeJoin="round"
            />
          </Group>
        ) : (
          <Group>
            <Path path={arrowPath} color={tint} opacity={glowOpacity}>
              <BlurMask blur={base * 0.06} style="normal" />
            </Path>
            <Path path={arrowPath}>
              <LinearGradient
                start={vec(cx, cy - len)}
                end={vec(cx, cy + len)}
                colors={[highlight, tint]}
              />
            </Path>
          </Group>
        )}
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
