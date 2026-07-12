import { Platform } from 'react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'

let configured = false

/** Configure RevenueCat with the signed-in user's Supabase ID as app_user_id. */
export function configurePurchases(userId: string) {
  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
  if (!apiKey || apiKey.includes('XXXX')) return // not configured yet
  if (configured) {
    Purchases.logIn(userId).catch(() => {})
    return
  }
  Purchases.configure({ apiKey, appUserID: userId })
  configured = true
}

export const isPurchasesConfigured = () => configured

/**
 * Token packs live in a RevenueCat Offering called "tokens".
 * Each package's product must carry metadata { tokens: <int> } in RevenueCat,
 * or follow the naming convention hapi_tokens_<amount> (e.g. hapi_tokens_500).
 *
 * Crediting happens SERVER-SIDE via the RevenueCat webhook
 * (/api/iap/revenuecat-webhook) → record_token_movement RPC.
 * Never credit tokens locally in the app.
 */
export async function getTokenPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return []
  const offerings = await Purchases.getOfferings()
  return offerings.all['tokens']?.availablePackages ?? []
}

export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null
  const offerings = await Purchases.getOfferings()
  return offerings.all['creator_pro']?.availablePackages[0] ?? null
}

export async function purchase(pkg: PurchasesPackage) {
  return Purchases.purchasePackage(pkg)
}

export async function restorePurchases() {
  return Purchases.restorePurchases()
}

export function tokensInProductId(productId: string): number {
  const m = productId.match(/hapi_tokens_(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}
