import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui'

import { conditionIcon, type TripWeather } from '../schemas'

type Glyph = keyof typeof Ionicons.glyphMap

export function WeatherCard({ weather }: { weather: TripWeather }) {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()

  return (
    <Surface
      color={theme.colors.card}
      borderColor={theme.colors.border}
      borderWidth={1}
      radius={theme.radius.lg}
      style={styles.card}
    >
      <View style={styles.header}>
        <Ionicons name="partly-sunny-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.title}>{t('weather.title')}</Text>
        <Text style={styles.place} numberOfLines={1}>
          {weather.place}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
      >
        {weather.days.map((day) => (
          <View key={day.date} style={styles.day}>
            <Text style={styles.dayLabel}>
              {new Date(`${day.date}T00:00:00`).toLocaleDateString(i18n.language, {
                weekday: 'short',
              })}
            </Text>
            <Ionicons
              name={conditionIcon(day.condition) as Glyph}
              size={22}
              color={theme.colors.foreground}
              accessibilityLabel={t(`weather.conditions.${day.condition}`)}
            />
            <Text style={styles.temp}>
              {day.tempMaxC}° / <Text style={styles.tempMin}>{day.tempMinC}°</Text>
            </Text>
          </View>
        ))}
      </ScrollView>

      {weather.mode === 'outlook' ? <Text style={styles.note}>{t('weather.outlook')}</Text> : null}
    </Surface>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    gap: theme.gap(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  title: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  place: {
    flex: 1,
    textAlign: 'right',
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  days: {
    gap: theme.gap(3),
    paddingVertical: theme.gap(1),
  },
  day: {
    alignItems: 'center',
    gap: theme.gap(1),
    minWidth: 56,
  },
  dayLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    textTransform: 'capitalize',
  },
  temp: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
    color: theme.colors.foreground,
  },
  tempMin: {
    color: theme.colors.muted,
  },
  note: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
}))
