import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { Segmented } from '@/components/ui'

export type PlanTab = 'timeline' | 'packing'

// Segmented control shared by the Plan screens (Timeline + Packing). Both are trip tabs, so
// switching segments is an instant tab switch (no stack push), which reads like a real segment.
// Built on the shared Segmented primitive so it stays visually identical to the rest of the app.
export function PlanSegmented({ active, tripId }: { active: PlanTab; tripId: string }) {
  const { t } = useTranslation()
  const router = useRouter()

  const options = [
    { label: t('tabs.timeline'), value: 'timeline' },
    { label: t('tabs.packing'), value: 'packing' },
  ]

  // Segmented only fires onChange for a different value, so this never re-navigates to the
  // already-active tab.
  const onChange = (value: string) => {
    if (value === 'packing') {
      router.navigate({ pathname: '/trips/[id]/packing', params: { id: tripId } })
    } else {
      router.navigate({ pathname: '/trips/[id]/timeline', params: { id: tripId } })
    }
  }

  return <Segmented options={options} value={active} onChange={onChange} />
}
