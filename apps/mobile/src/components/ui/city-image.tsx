import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { StyleSheet as RNStyleSheet, type StyleProp, View, type ViewStyle } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

// Vibrant indigo/sky/teal family for the colour cover when no photo is available.
const FALLBACK_TINTS = [
  '#4F46E5',
  '#6366F1',
  '#0EA5E9',
  '#0891B2',
  '#2563EB',
  '#0D9488',
  '#8B5CF6',
  '#DB2777',
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
  // 'top' rounds only the top corners (e.g. a card cover); 'all' is the default.
  corners?: 'all' | 'top'
  // Dark bottom overlay so white overlay text stays legible over a photo.
  scrim?: boolean
  // Overlay content (title, avatars, badges) positioned by the caller.
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

// The cover is a plain rounded View: the deterministic tint is the background, the photo
// (expo-image) fills it with corners clipped via overflow, and a dark bottom overlay keeps
// white text legible. No Skia.
export function CityImage({
  uri,
  seed,
  height,
  radius,
  corners = 'all',
  scrim = true,
  children,
  style,
}: CityImageProps) {
  const { theme } = useUnistyles()
  const cornerRadius = radius ?? theme.radius.lg
  const radiusStyle: ViewStyle =
    corners === 'top'
      ? { borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius }
      : { borderRadius: cornerRadius }

  return (
    <View
      style={[styles.container, radiusStyle, { height, backgroundColor: coverTint(seed) }, style]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={RNStyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      {scrim && uri ? <View style={styles.scrim} pointerEvents="none" /> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  container: {
    overflow: 'hidden',
    // Native iOS soft corners (no Skia) to match the rounded cards.
    borderCurve: 'continuous',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '35%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
}))
