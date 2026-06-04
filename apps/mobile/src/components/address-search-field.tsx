import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { Squircle } from '@/components/ui'
import { type PlaceResult, usePlaceSearch } from '@/features/places'

type AddressSearchFieldProps = {
  label?: string
  onSelect: (place: PlaceResult) => void
}

// A debounced address search with type-ahead suggestions. Picking a result hands the
// caller the coordinates (and label) and clears the field.
export function AddressSearchField({ label, onSelect }: AddressSearchFieldProps) {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  const language = i18n.language === 'fr' ? 'fr' : 'en'
  const { data: results, isFetching } = usePlaceSearch(debounced, language)

  function pick(place: PlaceResult) {
    onSelect(place)
    setQuery('')
    setDebounced('')
  }

  const open = query.trim().length >= 3

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        value={query}
        onChangeText={setQuery}
        placeholder={t('places.searchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {open ? (
        <Squircle
          radius={theme.radius.md}
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          style={styles.dropdown}
        >
          {isFetching && !results ? (
            <View style={styles.row}>
              <ActivityIndicator color={theme.colors.muted} />
            </View>
          ) : results && results.length > 0 ? (
            results.map((place, index) => (
              <Pressable
                key={`${place.lat},${place.lng},${place.label}`}
                onPress={() => pick(place)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="location-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.rowText} numberOfLines={2}>
                  {place.label}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={styles.row}>
              <Text style={styles.muted}>{t('places.noResults')}</Text>
            </View>
          )}
        </Squircle>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(1.5),
  },
  dropdown: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3),
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowText: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
  },
  muted: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
  },
  pressed: {
    opacity: 0.85,
  },
}))
