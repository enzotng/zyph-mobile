import { Image } from 'expo-image'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

const AVATAR_TINTS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']

// Shared so avatar-like primitives (Avatar, MemberChip) derive initials identically.
export function initialOf(name?: string): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase()
}

// --- Avatar ---

type AvatarProps = {
  name?: string
  initial?: string
  size?: number
  tint?: string
  ring?: boolean
  // Optional profile photo; falls back to the coloured initial while loading or if absent.
  imageUrl?: string | null
}

export function Avatar({ name, initial, size = 36, tint, ring = false, imageUrl }: AvatarProps) {
  const { theme } = useUnistyles()

  const resolvedInitial = initial?.trim() ? initial : initialOf(name)
  const charCode = resolvedInitial.charCodeAt(0)
  const background = tint ?? AVATAR_TINTS[charCode % AVATAR_TINTS.length]

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: background,
          ...(ring
            ? {
                borderWidth: 2,
                borderColor: theme.colors.background,
              }
            : {}),
        },
      ]}
      accessibilityLabel={name}
    >
      <Text
        style={[
          styles.initial,
          {
            fontSize: Math.round(size * 0.42),
          },
        ]}
      >
        {resolvedInitial}
      </Text>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { borderRadius: size }]}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  )
}

// --- AvatarStack ---

type AvatarStackMember = {
  id?: string
  name?: string
  initial?: string
  tint?: string
  imageUrl?: string | null
}

type AvatarStackProps = {
  members: AvatarStackMember[]
  size?: number
  max?: number
}

export function AvatarStack({ members, size = 30, max = 4 }: AvatarStackProps) {
  const { theme } = useUnistyles()

  const visible = members.slice(0, max)
  const overflow = members.length - max
  const overlap = Math.round(size * 0.32)

  return (
    <View style={styles.stack}>
      {visible.map((member, index) => (
        <View key={member.id ?? index} style={{ marginLeft: index === 0 ? 0 : -overlap }}>
          <Avatar
            name={member.name}
            initial={member.initial}
            tint={member.tint}
            imageUrl={member.imageUrl}
            size={size}
            ring
          />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.overflow,
            {
              width: size,
              height: size,
              borderRadius: size,
              marginLeft: -overlap,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: Math.round(size * 0.38) }]}>
            {overflow > 99 ? '+99' : `+${overflow}`}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  initial: {
    color: theme.colors.primaryForeground,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overflow: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  overflowText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
  },
}))
