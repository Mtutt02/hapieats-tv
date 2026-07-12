import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Ask permission, get the Expo push token, and upsert it to Supabase
 * (push_tokens table — see supabase/migrations/20260712_mobile_push_tokens.sql).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HapiEats',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#f97316',
      })
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') return null

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    )
    return token
  } catch (e) {
    console.warn('[push] registration failed', e)
    return null
  }
}

export async function unregisterPush(userId: string) {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token)
  } catch {
    /* non-fatal */
  }
}
