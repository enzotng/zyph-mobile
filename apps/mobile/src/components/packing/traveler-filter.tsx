import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Chip } from '@/components/ui'
import { UNASSIGNED_FILTER } from '@/features/packing'

type TravelerFilterProps = {
  members: { id: string; display_name: string | null }[]
  selected: string | null
  onChange: (value: string | null) => void
}

// A horizontal chip row to scope the shared list to one traveler: "Everyone", one chip per
// member, and "Unassigned". Pure presentational - filtering happens in the screen.
export function TravelerFilter({ members, selected, onChange }: TravelerFilterProps) {
  const { t } = useTranslation()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Chip
        label={t('packing.filterEveryone')}
        selected={selected === null}
        onPress={() => onChange(null)}
      />
      {members.map((member) => (
        <Chip
          key={member.id}
          label={member.display_name ?? t('common.member')}
          selected={selected === member.id}
          onPress={() => onChange(member.id)}
        />
      ))}
      <Chip
        label={t('packing.filterUnassigned')}
        selected={selected === UNASSIGNED_FILTER}
        onPress={() => onChange(UNASSIGNED_FILTER)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create((theme) => ({
  row: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
}))
