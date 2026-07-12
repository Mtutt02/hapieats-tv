import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from '@/providers/AuthProvider'
import { colors } from '@/lib/theme'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="watch/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="live-room/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="studio/upload" options={{ title: 'Upload Video' }} />
          <Stack.Screen name="studio/go-live" options={{ title: 'Go Live' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
