import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import type { PurchasesPackage } from 'react-native-purchases'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import {
  getTokenPackages, getProPackage, purchase, restorePurchases, isPurchasesConfigured,
} from '@/lib/purchases'
import { colors, radius } from '@/lib/theme'

export default function ProfileTab() {
  const { session, profile, signOut, refreshProfile } = useAuth()
  const [balance, setBalance] = useState(0)
  const [tokenPkgs, setTokenPkgs] = useState<PurchasesPackage[]>([])
  const [proPkg, setProPkg] = useState<PurchasesPackage | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('hapi_tokens')
      .select('balance')
      .eq('user_id', session.user.id)
      .maybeSingle()
    setBalance((data as { balance: number } | null)?.balance ?? 0)
    if (isPurchasesConfigured()) {
      getTokenPackages().then(setTokenPkgs).catch(() => {})
      getProPackage().then(setProPkg).catch(() => {})
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const buy = async (pkg: PurchasesPackage) => {
    setBuying(pkg.identifier)
    try {
      await purchase(pkg)
      // Tokens are credited server-side by the RevenueCat webhook — poll once after a moment
      setTimeout(load, 3000)
      Alert.alert('Purchase complete', 'Your tokens will appear in a few seconds.')
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string }
      if (!err.userCancelled) Alert.alert('Purchase failed', err.message ?? 'Try again.')
    } finally {
      setBuying(null)
    }
  }

  const isPro = profile?.platform_subscription_status === 'active'

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await Promise.all([load(), refreshProfile()])
            setRefreshing(false)
          }}
          tintColor={colors.accent}
        />
      }
    >
      {/* Identity */}
      <View style={s.identity}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarEmpty]}><Text style={{ fontSize: 28 }}>👤</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{profile?.display_name ?? profile?.username ?? 'Chef'}</Text>
          <Text style={s.username}>@{profile?.username}</Text>
          {isPro && <Text style={s.proBadge}>⭐ Creator Pro</Text>}
        </View>
      </View>

      {/* Token balance */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>Hapi Tokens</Text>
        <Text style={s.balanceNum}>🪙 {balance}</Text>
      </View>

      {/* Token shop */}
      <Text style={s.sectionH}>Get more tokens</Text>
      {!isPurchasesConfigured() ? (
        <Text style={s.dim}>
          In-app purchases aren’t configured in this build. Buy tokens at hapieatstv.com.
        </Text>
      ) : tokenPkgs.length === 0 ? (
        <Text style={s.dim}>Loading token packs…</Text>
      ) : (
        tokenPkgs.map(pkg => (
          <TouchableOpacity
            key={pkg.identifier}
            style={s.pkgRow}
            onPress={() => buy(pkg)}
            disabled={buying !== null}
          >
            <Text style={s.pkgTitle}>{pkg.product.title.replace(/\(.*\)$/, '').trim()}</Text>
            {buying === pkg.identifier ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={s.pkgPrice}>{pkg.product.priceString}</Text>
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Creator Pro */}
      {!isPro && proPkg && (
        <>
          <Text style={s.sectionH}>Creator Pro</Text>
          <TouchableOpacity style={[s.pkgRow, { borderColor: colors.accent }]} onPress={() => buy(proPkg)}>
            <View style={{ flex: 1 }}>
              <Text style={s.pkgTitle}>⭐ Go Pro — unlock live streaming</Text>
              <Text style={s.dim}>Stream from your phone, priority support</Text>
            </View>
            <Text style={s.pkgPrice}>{proPkg.product.priceString}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Account */}
      <Text style={s.sectionH}>Account</Text>
      {isPurchasesConfigured() && (
        <TouchableOpacity
          style={s.row}
          onPress={async () => {
            try { await restorePurchases(); Alert.alert('Done', 'Purchases restored.') }
            catch { Alert.alert('Nothing to restore') }
          }}
        >
          <Text style={s.rowText}>Restore purchases</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={s.row}
        onPress={() =>
          Alert.alert('Delete account', 'Account deletion is handled at hapieatstv.com → Settings → Privacy.')
        }
      >
        <Text style={s.rowText}>Delete account</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.row}
        onPress={() =>
          Alert.alert('Sign out?', '', [
            { text: 'Cancel' },
            { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/sign-in') } },
          ])
        }
      >
        <Text style={[s.rowText, { color: colors.live }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  username: { color: colors.textDim, marginTop: 2 },
  proBadge: { color: colors.accent, fontWeight: '700', fontSize: 12, marginTop: 4 },
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: colors.accentDim, marginBottom: 8,
  },
  balanceLabel: { color: colors.textDim, fontSize: 12 },
  balanceNum: { color: colors.accent, fontSize: 30, fontWeight: '800', marginTop: 4 },
  sectionH: { color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 24, marginBottom: 10 },
  dim: { color: colors.textDim, fontSize: 13 },
  pkgRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  pkgTitle: { color: colors.text, fontWeight: '600', flex: 1 },
  pkgPrice: { color: colors.accent, fontWeight: '800' },
  row: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  rowText: { color: colors.text, fontWeight: '600' },
})
