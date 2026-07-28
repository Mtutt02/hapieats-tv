import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { Link, router, Stack } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors, radius } from '@/lib/theme'

export default function SignUp() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (username.trim().length < 3) return setError('Username must be at least 3 characters')
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim().toLowerCase() } },
    })
    setBusy(false)
    if (error) return setError(error.message)
    if (data.session) router.replace('/(tabs)/home')
    else setDone(true) // email confirmation required
  }

  if (done) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ title: 'Check your email' }} />
        <Text style={s.h1}>📬 Almost there</Text>
        <Text style={{ color: colors.textDim, textAlign: 'center' }}>
          We sent a confirmation link to {email}. Tap it, then come back and sign in.
        </Text>
        <Link href="/(auth)/sign-in" style={s.link}>Back to sign in</Link>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Create account' }} />
      <Text style={s.logo}>🍜 HapiEats TV</Text>
      <Text style={s.h1}>Join the kitchen</Text>

      <TextInput
        style={s.input} placeholder="Username" placeholderTextColor={colors.textDim}
        autoCapitalize="none" value={username} onChangeText={setUsername}
      />
      <TextInput
        style={s.input} placeholder="Email" placeholderTextColor={colors.textDim}
        autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}
      />
      <TextInput
        style={s.input} placeholder="Password (8+ characters)" placeholderTextColor={colors.textDim}
        secureTextEntry value={password} onChangeText={setPassword}
      />

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create account</Text>}
      </TouchableOpacity>

      <Link href="/(auth)/sign-in" style={s.link}>Already have an account? Sign in</Link>
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
  btn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: colors.accent, textAlign: 'center', marginTop: 20 },
  error: { color: colors.live, marginBottom: 8, textAlign: 'center' },
})
