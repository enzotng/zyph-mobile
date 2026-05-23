import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { POI_ICONS, type PoiIcon } from '@/features/wayfinder'

const IONICON_MAP: Record<PoiIcon, keyof typeof Ionicons.glyphMap> = {
  pin: 'location',
  gate: 'airplane',
  bag: 'briefcase',
  food: 'restaurant',
  wc: 'water',
  cash: 'cash',
  taxi: 'car',
  wifi: 'wifi',
  star: 'star',
}

export function poiIconName(icon: string): keyof typeof Ionicons.glyphMap {
  return IONICON_MAP[icon as PoiIcon] ?? 'location'
}

type Props = {
  label?: string
  value: PoiIcon
  onChange: (icon: PoiIcon) => void
}

export function PoiIconPicker({ label, value, onChange }: Props) {
  const { theme } = useUnistyles()
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {POI_ICONS.map((icon) => {
          const selected = icon === value
          return (
            <Pressable
              key={icon}
              onPress={() => onChange(icon)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected ? styles.chipActive : null]}
            >
              <Ionicons
                name={IONICON_MAP[icon]}
                size={20}
                color={selected ? theme.colors.primaryForeground : theme.colors.foreground}
              />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.gap(11),
    height: theme.gap(11),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
}))
