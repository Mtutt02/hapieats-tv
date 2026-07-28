import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// SecureStore has a 2KB value limit — Supabase sessions can exceed it.
// Store the session in AsyncStorage but encrypt-worthy small values in SecureStore.
// For simplicity + reliability we use AsyncStorage (standard Supabase RN guidance)
// and SecureStore only for the refresh token backup.
const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

/** Best-effort secure backup of refresh token (optional hardening). */
export async function backupRefreshToken(token: string | null) {
  try {
    if (token) await SecureStore.setItemAsync('sb_refresh', token)
    else await SecureStore.deleteItemAsync('sb_refresh')
  } catch {
    /* non-fatal */
  }
}
