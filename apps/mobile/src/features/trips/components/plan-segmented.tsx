import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

export type PlanTab = 'timeline' | 'packing'

// Segmented control shared by the Plan screens (Timeline + Packing). Both are trip tabs, so
// switching segments is an instant tab switch (no stack push), which reads like a real segment.
export function PlanSegmented({ active, tripId }: { active: PlanTab; tripId: string }) {
  const { t } = useTranslation()
  const router = useRouter()

  const go = (target: PlanTab) => {
    if (target === active) {
      return
    }
    haptics.selection()
    if (target === 'timeline') {
      router.navigate({ pathname: '/trips/[id]/timeline', params: { id: tripId } })
    } else {
      router.navigate({ pathname: '/trips/[id]/packing', params: { id: tripId } })
    }
  }

  return (
    <View style={styles.track}>
      <Segment
        label={t('tabs.timeline')}
        active={active === 'timeline'}
        onPress={() => go('timeline')}
      />
      <Segment
        label={t('tabs.packing')}
        active={active === 'packing'}
        onPress={() => go('packing')}
      />
    </View>
  )
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    gap: theme.gap(1.5),
    padding: theme.gap(1),
    borderRadius: 14,
    borderCurve: 'continuous',
    // A subtle inset that reads in both themes; the active pill is the raised card on top.
    backgroundColor: withAlpha(theme.colors.foreground, 0.06),
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(2.25),
    borderRadius: 11,
    borderCurve: 'continuous',
  },
  segmentActive: {
    backgroundColor: theme.colors.card,
    shadowColor: '#1A1712',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  labelActive: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  pressed: {
    opacity: 0.7,
  },
}))
