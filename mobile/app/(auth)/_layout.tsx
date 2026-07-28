import { Stack, Redirect } from 'expo-router'
import { useAuth } from '@/providers/AuthProvider'
import { colors } from '@/lib/theme'

export default function AuthLayout() {
  const { session, loading } = useAuth()
  if (!loading && session) return <Redirect href="/(tabs)/home" />
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  )
}
