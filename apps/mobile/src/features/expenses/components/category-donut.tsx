import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import type { CategoryTotal } from '@/features/expenses'
import { categoryColor } from '@/features/taxonomy'

type CategoryDonutProps = {
  segments: CategoryTotal[]
  size?: number
  strokeWidth?: number
  children?: ReactNode
}

// A donut of the trip's spend split. One stroked arc per category, trimmed with Skia's start/end
// path props (a single circle path reused for every segment), coloured from the taxonomy palette so
// the ring matches the bars below it. The centre is a plain RN slot - the caller puts the total
// there, so no Skia text/font handling is needed.
export function CategoryDonut({
  segments,
  size = 168,
  strokeWidth = 22,
  children,
}: CategoryDonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.cents, 0)

  // One circle path, drawn inset by half the stroke so the ring stays inside the canvas.
  const path = useMemo(() => {
    const p = Skia.Path.Make()
    p.addCircle(size / 2, size / 2, (size - strokeWidth) / 2)
    return p
  }, [size, strokeWidth])

  // Cumulative [start, end] fractions per segment; skipped entirely when there is nothing to draw.
  // Guarded as `!(total > 0)` rather than `total <= 0` so a NaN total (which compares false against
  // everything) also short-circuits instead of producing NaN arc fractions.
  const arcs = useMemo(() => {
    if (!(total > 0)) {
      return []
    }
    let acc = 0
    return segments.map((segment) => {
      const start = acc
      const end = acc + segment.cents / total
      acc = end
      return {
        key: segment.category ?? 'uncategorized',
        start,
        end,
        color: categoryColor(segment.category),
      }
    })
  }, [segments, total])

  return (
    <View style={styles.wrap(size)}>
      <Canvas style={styles.canvas(size)}>
        {arcs.map((arc) => (
          <Path
            key={arc.key}
            path={path}
            color={arc.color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="butt"
            start={arc.start}
            end={arc.end}
          />
        ))}
      </Canvas>
      <View style={styles.centre(strokeWidth)} pointerEvents="none">
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  wrap: (size: number) => ({ width: size, height: size, alignSelf: 'center' as const }),
  canvas: (size: number) => ({ width: size, height: size }),
  // Overlays the canvas so the caller's content sits in the hole. Spelled out rather than spread
  // from `absoluteFillObject`, which does not carry through Unistyles' StyleSheet. Inset by the
  // stroke width so the content stays inside the ring instead of running over it.
  centre: (strokeWidth: number) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: strokeWidth,
  }),
}))
