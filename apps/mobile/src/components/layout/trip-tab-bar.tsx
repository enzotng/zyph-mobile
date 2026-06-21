import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { haptics } from '@/lib/haptics'

// Bottom space a scrollable trip screen should reserve so its last content clears the bar
// (the bar adds the safe-area inset itself, so this sits on top of that).
export const TRIP_TAB_BAR_CLEARANCE = 96

export type TripTab = {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

type TripTabBarProps = {
  // Four tabs (Cockpit, Plan, Spend, Map). The centre Add is a separate action between them.
  tabs: TripTab[]
  activeName: string
  onSelect: (name: string) => void
  onAdd: () => void
  addLabel: string
}

// iOS-style ease-out curve, matched to the app tab bar.
const SMOOTH_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const BAR_FADE_IN = FadeInDown.duration(280).easing(SMOOTH_EASING)

// The bezel is ink (dark) in both themes, so the icons stay cream; inactive is a warm grey.
const ACTIVE = '#F4F1E8'
const INACTIVE = '#6E685C'

function TripTabButton({
  tab,
  active,
  onPress,
}: {
  tab: TripTab
  active: boolean
  onPress: () => void
}) {
  const handlePress = () => {
    haptics.selection()
    onPress()
  }
  const color = active ? ACTIVE : INACTIVE

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Ionicons name={tab.icon} size={22} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {tab.label}
      </Text>
    </Pressable>
  )
}

// The in-trip tab bar: an ink bezel capsule with Cockpit / Plan on the left, a centre accent Add
// tile, and Spend / Map on the right. Zo is a separate FAB on the cockpit, not a tab here.
export function TripTabBar({ tabs, activeName, onSelect, onAdd, addLabel }: TripTabBarProps) {
  const { theme, rt } = useUnistyles()
  const left = tabs.slice(0, 2)
  const right = tabs.slice(2)

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
        {left.map((tab) => (
          <TripTabButton
            key={tab.name}
            tab={tab}
            active={activeName === tab.name}
            onPress={() => onSelect(tab.name)}
          />
        ))}

        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={25} color={theme.colors.primaryForeground} />
        </Pressable>

        {right.map((tab) => (
          <TripTabButton
            key={tab.name}
            tab={tab}
            active={activeName === tab.name}
            onPress={() => onSelect(tab.name)}
          />
        ))}
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
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    height: 64,
    paddingHorizontal: theme.gap(4),
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.bezel,
    shadowColor: '#1A1712',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 52,
  },
  label: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: 9,
  },
  addTile: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
}))
