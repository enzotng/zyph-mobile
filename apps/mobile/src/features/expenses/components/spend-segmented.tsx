import { useTranslation } from 'react-i18next'

import { Segmented } from '@/components/ui'

export type SpendTab = 'expenses' | 'balances' | 'stats'

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
