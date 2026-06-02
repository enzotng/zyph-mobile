import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'

import { type FloatingTab, FloatingTabBar } from '@/components/layout/floating-tab-bar'

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'airplane',
  profile: 'person-circle',
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const activeName = props.state.routes[props.state.index]?.name ?? ''
        const tabs: FloatingTab[] = props.state.routes.map((route) => ({
          key: route.key,
          name: route.name,
          label: props.descriptors[route.key]?.options.title ?? route.name,
          icon: TAB_ICONS[route.name] ?? 'ellipse',
        }))
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
      <Tabs.Screen name="index" options={{ title: 'Trips' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
