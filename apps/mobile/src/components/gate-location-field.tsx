import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { LocationPicker } from '@/components/location-picker'
import { TextField } from '@/components/text-field'

export type GateLocationValue = { label: string; lat: number; lng: number } | null

type Props = {
  value: GateLocationValue
  onChange: (next: GateLocationValue) => void
}

export function GateLocationField({ value, onChange }: Props) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const expanded = value !== null

  function toggle() {
    if (expanded) {
      onChange(null)
    } else {
      onChange({ label: '', lat: 0, lng: 0 })
    }
  }

  function updateLabel(label: string) {
    onChange({ label, lat: value?.lat ?? 0, lng: value?.lng ?? 0 })
  }

  function updateCoords(coords: { lat: number; lng: number }) {
    onChange({ label: value?.label ?? '', lat: coords.lat, lng: coords.lng })
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.toggle}
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: expanded }}
      >
        <Ionicons
          name={expanded ? 'checkbox' : 'square-outline'}
          size={22}
          color={expanded ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={styles.toggleLabel}>{t('gate.toggle')}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <TextField
            label={t('gate.label')}
            placeholder={t('gate.placeholder')}
            value={value?.label ?? ''}
            onChangeText={updateLabel}
          />
          <LocationPicker
            label={t('gate.location')}
            value={value && (value.lat !== 0 || value.lng !== 0) ? value : null}
            onChange={updateCoords}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.gap(2),
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  toggleLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  body: {
    gap: theme.gap(3),
  },
}))
