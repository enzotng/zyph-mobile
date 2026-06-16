import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { BottomSheet } from '@/components/ui'

type AddTripSheetProps = {
  open: boolean
  onClose: () => void
}

// The single create/join entry point, mounted from both the home dashboard and the all-trips list
// so "add a trip" lives in one place and reads the same everywhere.
export function AddTripSheet({ open, onClose }: AddTripSheetProps) {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <BottomSheet open={open} onClose={onClose} title={t('trips.addTitle')}>
      <View style={styles.actions}>
        <Button
          label={t('trips.create')}
          icon="add"
          onPress={() => {
            onClose()
            router.push('/trips/new')
          }}
        />
        <Button
          label={t('trips.join')}
          variant="secondary"
          icon="enter-outline"
          onPress={() => {
            onClose()
            router.push('/trips/join')
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
