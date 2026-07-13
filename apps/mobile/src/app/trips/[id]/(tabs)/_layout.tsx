import { Ionicons } from '@expo/vector-icons'
import { Tabs, useGlobalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'

import { type TripTab, TripTabBar } from '@/components/layout/trip-tab-bar'
import { TripAddSheet } from '@/features/trips/components/trip-add-sheet'
import { paramString } from '@/lib/routing'

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'albums',
  timeline: 'calendar-outline',
  expenses: 'wallet-outline',
}

// Cockpit, Plan, Spend - the three real tabs. Map is a tab-bar BUTTON, not a tab: it pushes the
// immersive map over the whole stack (so the bar is absent, not hidden). The centre Add is likewise
// an action, and `packing` is folded into Plan.
const TAB_ORDER = ['index', 'timeline', 'expenses'] as const
const MAP_ITEM = 'map'

export const unstable_settings = {
  initialRouteName: 'index',
}

export default function TripTabsLayout() {
  const { t } = useTranslation()
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const rawActive = props.state.routes[props.state.index]?.name ?? ''
          // `packing` has no tab of its own - it lives under the Plan (timeline) segment, so keep
          // Plan highlighted while packing is open.
          const activeName = rawActive === 'packing' ? 'timeline' : rawActive
          const routesByName = new Map(props.state.routes.map((route) => [route.name, route]))
          const tabs: TripTab[] = TAB_ORDER.flatMap((name) => {
            const route = routesByName.get(name)
            if (!route) {
              return []
            }
            return [
              {
                name: route.name,
                label: props.descriptors[route.key]?.options.title ?? route.name,
                icon: TAB_ICONS[name] ?? 'ellipse',
              },
            ]
          })
          tabs.push({
            name: MAP_ITEM,
            label: Platform.OS === 'ios' ? t('tabs.map') : t('tabs.places'),
            icon: 'map-outline',
          })
          return (
            <TripTabBar
              tabs={tabs}
              activeName={activeName}
              addLabel={t('trip.addSheetTitle')}
              onAdd={() => setAddOpen(true)}
              onSelect={(name) => {
                if (name === MAP_ITEM) {
                  router.push({ pathname: '/trips/[id]/pois', params: { id: tripId } })
                  return
                }
                const route = props.state.routes.find((r) => r.name === name)
                if (!route) {
                  return
                }
                const event = props.navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (activeName !== name && !event.defaultPrevented) {
                  props.navigation.navigate(route.name)
                }
              }}
            />
          )
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.cockpit') }} />
        <Tabs.Screen name="timeline" options={{ title: t('tabs.plan') }} />
        <Tabs.Screen name="expenses" options={{ title: t('tabs.spend') }} />
        <Tabs.Screen name="packing" options={{ title: t('tabs.packing') }} />
      </Tabs>
      <TripAddSheet open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} />
    </>
  )
}
