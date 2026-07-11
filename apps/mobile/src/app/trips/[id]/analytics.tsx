import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Screen } from '@/components/screen'
import { StatsView } from '@/features/expenses/components/stats-view'
import { paramString } from '@/lib/routing'

export default function AnalyticsScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)

  return (
    <Screen title={t('analytics.title')} showBack>
      <StatsView tripId={tripId} />
    </Screen>
  )
}
