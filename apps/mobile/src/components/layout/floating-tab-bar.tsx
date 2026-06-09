import { Ionicons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

// Bottom space a scrollable tab screen should reserve so its last content clears the
// floating bar (the bar adds the safe-area inset itself, so this is on top of that).
export const FLOATING_TAB_BAR_CLEARANCE = 72

export type FloatingTab = {
  key: string
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
}

// A standalone right-hand action (not a tab) - e.g. the Zo copilot, which pushes a screen
// rather than switching tabs. When set, every tab goes into the left group.
export type FloatingTabAction = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}

type FloatingTabBarProps = {
  tabs: FloatingTab[]
  activeName: string
  onSelect: (name: string) => void
  soloAction?: FloatingTabAction
}

// iOS-style ease-out curve.
const SMOOTH_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const PILL_TRANSITION = LinearTransition.duration(320).easing(SMOOTH_EASING)
const LABEL_FADE_IN = FadeIn.delay(120).duration(180).easing(SMOOTH_EASING)
const LABEL_FADE_OUT = FadeOut.duration(140).easing(SMOOTH_EASING)
const BAR_FADE_IN = FadeInDown.duration(280).easing(SMOOTH_EASING)

const GROUP_PADDING = 5
const ITEM_HEIGHT = 48
const SOLO_HEIGHT = ITEM_HEIGHT + GROUP_PADDING * 2
const ITEM_RADIUS = ITEM_HEIGHT / 2
const SOLO_RADIUS = SOLO_HEIGHT / 2
const BG_DURATION = 320

type TabPillProps = {
  tab: FloatingTab
  active: boolean
  activeBg: string
  activeFg: string
  inactiveBg: string
  inactiveFg: string
  onPress: () => void
  height: number
  radius: number
  iconSize: number
  solo?: boolean
  // When false, the active pill stays icon-only (no expanding label) - used when the bar holds
  // many tabs and the expanded label would overflow on narrow screens.
  showLabel?: boolean
}

function TabPill({
  tab,
  active,
  activeBg,
  activeFg,
  inactiveBg,
  inactiveFg,
  onPress,
  height,
  radius,
  iconSize,
  solo = false,
  showLabel = true,
}: TabPillProps) {
  const expanded = active && showLabel
  const progress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: BG_DURATION, easing: SMOOTH_EASING })
  }, [active, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [inactiveBg, activeBg]),
  }))

  const handlePress = () => {
    haptics.selection()
    onPress()
  }

  return (
    <Animated.View
      layout={PILL_TRANSITION}
      style={[
        styles.pill,
        { height, borderRadius: radius },
        solo && !active && styles.soloBorder,
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.label}
        style={({ pressed }) => [
          styles.pillPress,
          { height, width: expanded ? undefined : height },
          expanded && styles.pillPressActive,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={tab.icon} size={iconSize} color={active ? activeFg : inactiveFg} />
        {expanded ? (
          <Animated.View entering={LABEL_FADE_IN} exiting={LABEL_FADE_OUT}>
            <Text style={[styles.label, { color: activeFg }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

// Floating bar: a left group sharing a card capsule, plus a standalone pill on the right
// (the last tab). The active pill fills with the brand color and expands to show its label.
export function FloatingTabBar({ tabs, activeName, onSelect, soloAction }: FloatingTabBarProps) {
  const { theme, rt } = useUnistyles()

  if (tabs.length === 0 && !soloAction) {
    return null
  }

  // With a solo action, all tabs share the left group and the action is the right pill.
  const leftTabs = soloAction ? tabs : tabs.slice(0, -1)
  const rightTab = soloAction ? undefined : tabs[tabs.length - 1]
  // From 5 left tabs, keep them icon-only so the expanded active label can't push the bar
  // past a narrow screen (iPhone SE / mini).
  const showLeftLabels = leftTabs.length < 5

  return (
    <Animated.View
      entering={BAR_FADE_IN}
      pointerEvents="box-none"
      style={[styles.bar, { paddingBottom: Math.max(rt.insets.bottom, 12) }]}
    >
      {leftTabs.length > 0 ? (
        <View style={styles.group}>
          {leftTabs.map((tab) => (
            <TabPill
              key={tab.key}
              tab={tab}
              active={activeName === tab.name}
              activeBg={theme.colors.primary}
              activeFg={theme.colors.primaryForeground}
              inactiveBg={withAlpha(theme.colors.primary, 0)}
              inactiveFg={theme.colors.foreground}
              onPress={() => onSelect(tab.name)}
              height={ITEM_HEIGHT}
              radius={ITEM_RADIUS}
              iconSize={18}
              showLabel={showLeftLabels}
            />
          ))}
        </View>
      ) : null}

      {soloAction ? (
        <Pressable
          onPress={() => {
            haptics.selection()
            soloAction.onPress()
          }}
          accessibilityRole="button"
          accessibilityLabel={soloAction.label}
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}
        >
          <View
            style={[
              styles.pill,
              styles.soloAction,
              { height: SOLO_HEIGHT, borderRadius: SOLO_RADIUS },
            ]}
          >
            <Ionicons name={soloAction.icon} size={20} color={theme.colors.primaryForeground} />
            <Text style={[styles.label, styles.soloActionLabel]}>{soloAction.label}</Text>
          </View>
        </Pressable>
      ) : rightTab ? (
        <TabPill
          tab={rightTab}
          active={activeName === rightTab.name}
          activeBg={theme.colors.primary}
          activeFg={theme.colors.primaryForeground}
          inactiveBg={theme.colors.card}
          inactiveFg={theme.colors.foreground}
          onPress={() => onSelect(rightTab.name)}
          height={SOLO_HEIGHT}
          radius={SOLO_RADIUS}
          iconSize={20}
          solo
        />
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.gap(3),
    paddingTop: theme.gap(2),
  },
  group: {
    flexDirection: 'row',
    gap: theme.gap(0.5),
    padding: GROUP_PADDING,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pill: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  soloBorder: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pillPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  pillPressActive: {
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(3),
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  soloAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(3.5),
    backgroundColor: theme.colors.primary,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  soloActionLabel: {
    color: theme.colors.primaryForeground,
  },
}))
