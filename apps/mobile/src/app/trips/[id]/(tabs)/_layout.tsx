import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { type FloatingTab, FloatingTabBar } from '@/components/layout/floating-tab-bar'

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'grid',
  timeline: 'time',
  expenses: 'wallet',
  pois: 'navigate',
}

// Explicit order so the floating bar always renders Places (pois) as the standalone
// right pill - expo-router would otherwise sort the tab routes alphabetically.
const TAB_ORDER = ['index', 'timeline', 'expenses', 'pois'] as const

export const unstable_settings = {
  initialRouteName: 'index',
}

export default function TripTabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const activeName = props.state.routes[props.state.index]?.name ?? ''
        const routesByName = new Map(props.state.routes.map((route) => [route.name, route]))
        const tabs: FloatingTab[] = TAB_ORDER.flatMap((name) => {
          const route = routesByName.get(name)
          if (!route) {
            return []
          }
          return [
            {
              key: route.key,
              name: route.name,
              label: props.descriptors[route.key]?.options.title ?? route.name,
              icon: TAB_ICONS[name] ?? 'ellipse',
            },
          ]
        })
        return (
          <FloatingTabBar
            tabs={tabs}
            activeName={activeName}
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
      <Tabs.Screen name="index" options={{ title: t('tabs.overview') }} />
      <Tabs.Screen name="timeline" options={{ title: t('tabs.timeline') }} />
      <Tabs.Screen name="expenses" options={{ title: t('tabs.expenses') }} />
      <Tabs.Screen name="pois" options={{ title: t('tabs.places') }} />
    </Tabs>
  )
}
