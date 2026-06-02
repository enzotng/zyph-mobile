import { Stack } from 'expo-router'

// The tab group is the trip's home; detail/modal screens (add-expense, edit, map, ar,
// expense/event/poi details) push on top of it so they cover the floating tab bar.
export const unstable_settings = {
  initialRouteName: '(tabs)',
}

export default function TripLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
