import { useGlobalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Screen } from '@/components/screen'
import { BalancesView } from '@/features/settlements/components/balances-view'
import { paramString } from '@/lib/routing'

export default function TripBalancesScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { t } = useTranslation()

  return (
    <Screen title={t('balances.title')} showBack>
      <BalancesView tripId={tripId} />
    </Screen>
  )
}
