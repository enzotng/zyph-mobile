import { Ionicons } from '@expo/vector-icons'
import { Tabs, useGlobalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type TripTab, TripTabBar } from '@/components/layout/trip-tab-bar'
import { TripAddSheet } from '@/features/trips/components/trip-add-sheet'
import { paramString } from '@/lib/routing'

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'albums',
  timeline: 'calendar-outline',
  expenses: 'wallet-outline',
  pois: 'map-outline',
}

// Cockpit, Plan, Spend, Map - the four tab buttons. The centre Add is a separate action and
// `packing` is folded into Plan, so neither is a tab here. expo-router would otherwise sort routes.
const TAB_ORDER = ['index', 'timeline', 'expenses', 'pois'] as const

export const unstable_settings = {
  initialRouteName: 'index',
}

export default function TripTabsLayout() {
  const { t } = useTranslation()
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const activeName = props.state.routes[props.state.index]?.name ?? ''
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
          return (
            <TripTabBar
              tabs={tabs}
              activeName={activeName}
              addLabel={t('trip.addSheetTitle')}
              onAdd={() => setAddOpen(true)}
              onSelect={(name) => {
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
        <Tabs.Screen name="pois" options={{ title: t('tabs.map') }} />
        <Tabs.Screen name="packing" options={{ title: t('tabs.packing') }} />
      </Tabs>
      <TripAddSheet open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} />
    </>
  )
}
