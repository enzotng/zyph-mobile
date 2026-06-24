import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { BottomSheet } from '@/components/ui'

type TripAddSheetProps = {
  open: boolean
  onClose: () => void
  tripId: string
}

// The centre Add action of the trip tab bar: a single chooser for the things you can add to a
// trip (event, expense, place), so "add" lives in one place across every trip tab.
export function TripAddSheet({ open, onClose, tripId }: TripAddSheetProps) {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <BottomSheet open={open} onClose={onClose} title={t('trip.addSheetTitle')}>
      <View style={styles.actions}>
        <Button
          label={t('timeline.addEvent')}
          icon="calendar-outline"
          onPress={() => {
            onClose()
            router.push({ pathname: '/trips/[id]/add-event', params: { id: tripId } })
          }}
        />
        <Button
          label={t('expenseForm.addTitle')}
          icon="wallet-outline"
          variant="secondary"
          onPress={() => {
            onClose()
            router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
          }}
        />
        <Button
          label={t('poiForm.addTitle')}
          icon="location-outline"
          variant="secondary"
          onPress={() => {
            onClose()
            router.push({ pathname: '/trips/[id]/pois/new', params: { id: tripId } })
          }}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    gap: theme.gap(2),
  },
}))
