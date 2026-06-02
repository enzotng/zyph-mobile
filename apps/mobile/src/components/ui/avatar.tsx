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
}

export function Avatar({ name, initial, size = 36, tint, ring = false }: AvatarProps) {
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
    </View>
  )
}

// --- AvatarStack ---

type AvatarStackMember = {
  id?: string
  name?: string
  initial?: string
  tint?: string
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
          <Avatar name={member.name} initial={member.initial} tint={member.tint} size={size} ring />
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
            {`+${overflow}`}
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
  },
  initial: {
    color: theme.colors.primaryForeground,
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
    fontWeight: '600',
  },
}))
