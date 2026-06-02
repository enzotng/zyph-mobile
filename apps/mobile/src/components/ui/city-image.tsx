import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia'
import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  type LayoutChangeEvent,
  StyleSheet as RNStyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

// Calm indigo/sky/slate family used as a cover tint when no photo is available.
const FALLBACK_TINTS = [
  '#4F46E5',
  '#6366F1',
  '#0EA5E9',
  '#0891B2',
  '#2563EB',
  '#0F766E',
  '#1E293B',
  '#475569',
]

// Deterministic so a given trip always gets the same cover colour across renders/sessions.
export function coverTint(seed: string | undefined): string {
  if (!seed) {
    return FALLBACK_TINTS[0]
  }
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length]
}

type CityImageProps = {
  // Photo URL; when absent, a deterministic colour cover is shown instead.
  uri?: string | null
  // Seed for the fallback tint (e.g. destination or title).
  seed?: string
  height: number
  radius?: number
  // Dark bottom gradient so white overlay text stays legible over any photo.
  scrim?: boolean
  // Overlay content (title, avatars, badges) positioned by the caller.
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function CityImage({
  uri,
  seed,
  height,
  radius,
  scrim = true,
  children,
  style,
}: CityImageProps) {
  const { theme } = useUnistyles()
  const cornerRadius = radius ?? theme.radius.lg
  const [width, setWidth] = useState(0)

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width)
  }

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { height, borderRadius: cornerRadius, backgroundColor: coverTint(seed) },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={RNStyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
        />
      ) : null}

      {scrim && width > 0 ? (
        <Canvas style={RNStyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              positions={[0.35, 1]}
              colors={['rgba(15, 23, 42, 0)', 'rgba(15, 23, 42, 0.82)']}
            />
          </Rect>
        </Canvas>
      ) : null}

      {children}
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  container: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
}))
