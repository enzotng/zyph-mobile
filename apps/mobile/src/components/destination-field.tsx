import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TextField } from '@/components/text-field'
import { Surface } from '@/components/ui'
import { type PlaceResult, usePlaceSearch } from '@/features/places'

type DestinationFieldProps = {
  label?: string
  value: string
  error?: string
  hasCoordinates: boolean
  // Free-text typing: the caller stores the text and clears any saved coordinates.
  onChangeText: (text: string) => void
  // A suggestion was picked: the caller stores the canonical label + coordinates.
  onSelectPlace: (place: PlaceResult) => void
}

// The trip destination as a type-ahead. Unlike AddressSearchField (which clears on select), this
// is a controlled form field: it shows the current destination, suggests places as you type, and
// picking one hands the caller the label + coordinates. Free text is still allowed (coords null).
export function DestinationField({
  label,
  value,
  error,
  hasCoordinates,
  onChangeText,
  onSelectPlace,
}: DestinationFieldProps) {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // The caller drops the coordinates on every keystroke, so `hasCoordinates` alone cannot tell a
  // destination that was never geolocated from one that just lost its geolocation - hence the latch.
  const [wasGeolocated, setWasGeolocated] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  if (hasCoordinates && !wasGeolocated) setWasGeolocated(true)

  const language = i18n.language === 'fr' ? 'fr' : 'en'
  const { data: results, isFetching } = usePlaceSearch(debounced, language)

  function handleChange(text: string) {
    onChangeText(text)
    setQuery(text)
  }

  function pick(place: PlaceResult) {
    onSelectPlace(place)
    // Stop searching and close the dropdown; the field now shows the picked label.
    setQuery('')
    setDebounced('')
  }

  const open = query.trim().length >= 3

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        value={value}
        onChangeText={handleChange}
        placeholder={t('tripForm.destinationPlaceholder')}
        autoCorrect={false}
        error={error}
      />
      {/* An emptied field is a deliberate choice, not a lost geolocation: the destination is
          optional, so telling them to re-pick a suggestion there would be nagging. */}
      {wasGeolocated && !hasCoordinates && value.trim().length > 0 ? (
        <View style={styles.hint}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warning} />
          <Text style={styles.hintText}>{t('tripForm.geoHint')}</Text>
        </View>
      ) : null}
      {open ? (
        <Surface
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
        </Surface>
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
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.gap(1.5),
  },
  hintText: {
    flex: 1,
    color: theme.colors.warning,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
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
