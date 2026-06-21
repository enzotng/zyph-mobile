import { Ionicons } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

// Bottom space a scrollable app screen should reserve so its last content clears the
// app tab bar (the bar adds the safe-area inset itself, so this sits on top of that).
export const APP_TAB_BAR_CLEARANCE = 84

export type AppTab = {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

type AppTabBarProps = {
  tabs: AppTab[]
  activeName: string
  onSelect: (name: string) => void
  onAdd: () => void
  addLabel: string
}

// iOS-style ease-out curve, matched to the floating in-trip bar.
const SMOOTH_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const BAR_FADE_IN = FadeInDown.duration(280).easing(SMOOTH_EASING)

// The bezel is ink (dark) in BOTH themes, so the icons must stay cream in both - deriving them
// from theme.colors.background would turn near-black on the dark-theme bezel.
const CREAM = '#F4F1E8'

type TabButtonProps = {
  tab: AppTab
  active: boolean
  onPress: () => void
  activeColor: string
  inactiveColor: string
}

function TabButton({ tab, active, onPress, activeColor, inactiveColor }: TabButtonProps) {
  const handlePress = () => {
    haptics.selection()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Ionicons name={tab.icon} size={24} color={active ? activeColor : inactiveColor} />
    </Pressable>
  )
}

// The app-level tab bar: an ink bezel capsule with Home on the left, an accent (indigo) Add
// tile in the centre, and Profile on the right. Distinct from the in-trip FloatingTabBar (which
// carries the Zo FAB); this one never switches into a trip.
export function AppTabBar({ tabs, activeName, onSelect, onAdd, addLabel }: AppTabBarProps) {
  const { theme, rt } = useUnistyles()

  // Cream for the active tab, a dimmed cream for the rest - legible on the ink bezel in both themes.
  const activeColor = CREAM
  const inactiveColor = withAlpha(CREAM, 0.55)

  const handleAdd = () => {
    haptics.light()
    onAdd()
  }

  return (
    <Animated.View
      entering={BAR_FADE_IN}
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(rt.insets.bottom, 12) }]}
    >
      <View style={styles.bar}>
        {tabs[0] ? (
          <TabButton
            tab={tabs[0]}
            active={activeName === tabs[0].name}
            onPress={() => onSelect(tabs[0].name)}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
          />
        ) : null}

        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={28} color={theme.colors.primaryForeground} />
        </Pressable>

        {tabs[1] ? (
          <TabButton
            tab={tabs[1]}
            active={activeName === tabs[1].name}
            onPress={() => onSelect(tabs[1].name)}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
          />
        ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(2),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(4),
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bezel,
    shadowColor: '#1A1712',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
}))
