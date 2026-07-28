import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { Link, router, Stack } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors, radius } from '@/lib/theme'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setError(error.message)
    router.replace('/(tabs)/home')
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Text style={s.logo}>🍜 HapiEats TV</Text>
      <Text style={s.h1}>Welcome back</Text>

      <TextInput
        style={s.input}
        placeholder="Email"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        placeholderTextColor={colors.textDim}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
      </TouchableOpacity>

      <Link href="/(auth)/sign-up" style={s.link}>
        New here? Create an account
      </Link>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
  logo: { fontSize: 28, textAlign: 'center', marginBottom: 8, color: colors.text, fontWeight: '800' },
  h1: { fontSize: 18, color: colors.textDim, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md, padding: 15,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: colors.accent, textAlign: 'center', marginTop: 20 },
  error: { color: colors.live, marginBottom: 8, textAlign: 'center' },
})
