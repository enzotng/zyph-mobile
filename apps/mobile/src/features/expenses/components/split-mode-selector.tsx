import { useTranslation } from 'react-i18next'

import { Segmented } from '@/components/ui/segmented'

import { SPLIT_MODES, type SplitMode } from '../split-modes'

type SplitModeSelectorProps = {
  mode: SplitMode
  onChange: (mode: SplitMode) => void
}

export function SplitModeSelector({ mode, onChange }: SplitModeSelectorProps) {
  const { t } = useTranslation()
  const options = SPLIT_MODES.map((m) => ({ value: m, label: t(`expenseForm.mode_${m}`) }))
  return <Segmented options={options} value={mode} onChange={(v) => onChange(v as SplitMode)} />
}
