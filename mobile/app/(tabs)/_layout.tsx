import { Tabs, Redirect } from 'expo-router'
import { Text } from 'react-native'
import { useAuth } from '@/providers/AuthProvider'
import { colors } from '@/lib/theme'

function Icon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
}

export default function TabsLayout() {
  const { session, loading } = useAuth()
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: p => <Icon glyph="🏠" focused={p.focused} /> }}
      />
      <Tabs.Screen
        name="tv"
        options={{ title: 'TV', headerShown: false, tabBarIcon: p => <Icon glyph="📺" focused={p.focused} /> }}
      />
      <Tabs.Screen
        name="live"
        options={{ title: 'Live', tabBarIcon: p => <Icon glyph="📡" focused={p.focused} /> }}
      />
      <Tabs.Screen
        name="studio"
        options={{ title: 'Studio', tabBarIcon: p => <Icon glyph="🎬" focused={p.focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: p => <Icon glyph="👤" focused={p.focused} /> }}
      />
    </Tabs>
  )
}
