import { Ionicons } from '@expo/vector-icons'
import { type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Avatar } from '@/components/ui'
import { haptics } from '@/lib/haptics'

type Indicator = 'radio' | 'check' | 'none'

type MemberRowProps = {
  name: string
  imageUrl?: string | null
  // Leading selection indicator: radio for single-select (payer), check for multi-select (split),
  // none when the row is not itself a toggle (e.g. a payer amount entry).
  indicator?: Indicator
  selected?: boolean
  onPress?: () => void
  // Trailing content (a read-only Amount, a stepper, or an input), right-aligned.
  right?: ReactNode
  // Dim an excluded member (kept visible for context but visually de-emphasised).
  dimmed?: boolean
  accessibilityLabel?: string
}

// A single person rendered as a calm 56pt row: leading selection indicator + avatar + name, with an
// optional trailing control. Replaces the horizontal chip scroll so every member is visible at once
// with a full-width tap target, and gives the payer picker and the split list one shared language.
export function MemberRow({
  name,
  imageUrl,
  indicator = 'none',
  selected = false,
  onPress,
  right,
  dimmed = false,
  accessibilityLabel,
}: MemberRowProps) {
  const { theme } = useUnistyles()

  const indicatorIcon =
    indicator === 'radio'
      ? selected
        ? 'radio-button-on'
        : 'radio-button-off'
      : indicator === 'check'
        ? selected
          ? 'checkbox'
          : 'square-outline'
        : null

  const inner = (
    <>
      {indicatorIcon ? (
        <Ionicons
          name={indicatorIcon}
          size={22}
          color={selected ? theme.colors.primary : theme.colors.muted}
        />
      ) : null}
      <Avatar name={name} imageUrl={imageUrl} size={36} ring={selected} />
      <Text style={[styles.name, dimmed && styles.nameDimmed]} numberOfLines={1}>
        {name}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  )

  if (!onPress) {
    return <View style={styles.row}>{inner}</View>
  }

  const handlePress = () => {
    haptics.light()
    onPress()
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole={
        indicator === 'radio' ? 'radio' : indicator === 'check' ? 'checkbox' : 'button'
      }
      // `checked`/`selected` are only meaningful for checkbox/radio; a plain button row gets neither.
      accessibilityState={
        indicator === 'radio' ? { selected } : indicator === 'check' ? { checked: selected } : {}
      }
      accessibilityLabel={accessibilityLabel ?? name}
    >
      {inner}
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    minHeight: 56,
    paddingVertical: theme.gap(1.5),
  },
  pressed: {
    opacity: 0.85,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    color: theme.colors.foreground,
  },
  nameDimmed: {
    color: theme.colors.muted,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
}))
