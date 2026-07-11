import { useTranslation } from 'react-i18next'

import { Segmented } from '@/components/ui'

export type SpendTab = 'expenses' | 'balances' | 'stats'

// Controlled segmented for the Spend tab: switching segments swaps the active body in place (no
// navigation, unlike PlanSegmented which pushes a route). The active tab lives in the host
// screen's state, so this component stays a pure controlled Segmented wrapper.
export function SpendSegmented({
  value,
  onChange,
}: {
  value: SpendTab
  onChange: (tab: SpendTab) => void
}) {
  const { t } = useTranslation()

  const options = [
    { label: t('tabs.spend'), value: 'expenses' },
    { label: t('balances.title'), value: 'balances' },
    { label: t('analytics.tab'), value: 'stats' },
  ]

  return <Segmented options={options} value={value} onChange={(v) => onChange(v as SpendTab)} />
}
