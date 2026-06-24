import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type AppTab, AppTabBar } from '@/components/layout/app-tab-bar'
import { AddTripSheet } from '@/features/trips/components/add-trip-sheet'

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'albums',
  profile: 'person-outline',
}

export default function TabsLayout() {
  const { t } = useTranslation()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const activeName = props.state.routes[props.state.index]?.name ?? ''
          const tabs: AppTab[] = props.state.routes.map((route) => ({
            name: route.name,
            label: props.descriptors[route.key]?.options.title ?? route.name,
            icon: TAB_ICONS[route.name] ?? 'ellipse',
          }))
          return (
            <AppTabBar
              tabs={tabs}
              activeName={activeName}
              addLabel={t('trips.addTitle')}
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
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
