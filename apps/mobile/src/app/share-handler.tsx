import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, Spinner } from '@/components/ui'
import { useTrips } from '@/features/trips'
import { paramString } from '@/lib/routing'

// Landing screen after an OS share: pick the destination trip, then deep-link into Smart Import
// with the shared text pre-filled. Reached from ShareIntentRouter (foreground share) or the
// pending-share replay after sign-in.
export default function ShareHandlerScreen() {
  const params = useGlobalSearchParams<{ text: string }>()
  const text = paramString(params.text)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { data: trips, isLoading } = useTrips()

  // Exactly one trip -> skip the picker and go straight to Smart Import.
  useEffect(() => {
    if (trips && trips.length === 1) {
      const only = trips[0]
      if (only) {
        router.replace({
          pathname: '/trips/[id]/import-email',
          params: { id: only.id, prefilledText: text },
        })
      }
    }
  }, [trips, text, router])

  if (isLoading) {
    return (
      <Screen title={t('shareHandler.title')} showBack>
        <Spinner label={t('shareHandler.loading')} />
      </Screen>
    )
  }

  if (!trips || trips.length === 0) {
    return (
      <Screen title={t('shareHandler.title')} showBack>
        <EmptyState
          icon="airplane-outline"
          title={t('shareHandler.emptyTitle')}
          body={t('shareHandler.emptyBody')}
          cta={t('shareHandler.emptyCta')}
          onCta={() => router.replace('/')}
        />
      </Screen>
    )
  }

  return (
    <Screen title={t('shareHandler.title')} showBack>
      <Text style={styles.lede}>{t('shareHandler.lede')}</Text>
      <View style={styles.listWrap}>
        <FlashList
          data={trips}
          keyExtractor={(trip) => trip.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/trips/[id]/import-email',
                  params: { id: item.id, prefilledText: text },
                })
              }
              accessibilityRole="button"
              style={styles.row}
            >
              <Ionicons name="airplane" size={20} color={theme.colors.primary} />
              <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                {item.destination ? <Text style={styles.subtitle}>{item.destination}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
            </Pressable>
          )}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  lede: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    paddingBottom: theme.gap(3),
  },
  listWrap: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  info: {
    flex: 1,
    gap: theme.gap(1),
  },
  title: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  subtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
