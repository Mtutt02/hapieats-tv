import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { colors, radius } from '@/lib/theme'

interface Wallet {
  tokens_received: number
  redeemable_cents: number
  lifetime_earnings_cents: number
}

export default function Studio() {
  const { session, profile } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [videoCount, setVideoCount] = useState(0)
  const [totalViews, setTotalViews] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    const [{ data: w }, { data: vids }] = await Promise.all([
      supabase
        .from('creator_wallets')
        .select('tokens_received, redeemable_cents, lifetime_earnings_cents')
        .eq('creator_id', session.user.id)
        .maybeSingle(),
      supabase
        .from('videos')
        .select('id, view_count')
        .eq('creator_id', session.user.id),
    ])
    setWallet((w as Wallet) ?? null)
    setVideoCount(vids?.length ?? 0)
    setTotalViews((vids ?? []).reduce((sum, v) => sum + (v.view_count ?? 0), 0))
  }, [session])

  useEffect(() => { load() }, [load])

  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const isPro = profile?.platform_subscription_status === 'active'

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
          tintColor={colors.accent}
        />
      }
    >
      <Text style={s.h1}>Creator Studio</Text>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statNum}>{videoCount}</Text>
          <Text style={s.statLabel}>Videos</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{totalViews}</Text>
          <Text style={s.statLabel}>Views</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{wallet?.tokens_received ?? 0}</Text>
          <Text style={s.statLabel}>Tokens earned</Text>
        </View>
      </View>

      {/* Wallet */}
      <View style={s.walletCard}>
        <Text style={s.walletLabel}>Redeemable earnings</Text>
        <Text style={s.walletAmount}>{usd(wallet?.redeemable_cents ?? 0)}</Text>
        <Text style={s.walletLifetime}>Lifetime: {usd(wallet?.lifetime_earnings_cents ?? 0)}</Text>
        <Text style={s.walletNote}>Payouts are managed on hapieatstv.com → Creator Studio</Text>
      </View>

      {/* Actions */}
      <TouchableOpacity style={s.bigBtn} onPress={() => router.push('/studio/upload')}>
        <Text style={s.bigBtnEmoji}>📤</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.bigBtnTitle}>Upload a video</Text>
          <Text style={s.bigBtnSub}>Pick from your library, uploads straight to Mux</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.bigBtn, !isPro && { opacity: 0.6 }]}
        onPress={() => router.push('/studio/go-live')}
      >
        <Text style={s.bigBtnEmoji}>📡</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.bigBtnTitle}>Go live</Text>
          <Text style={s.bigBtnSub}>
            {isPro ? 'Stream from your phone camera' : 'Requires Creator Pro — upgrade in Profile'}
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  h1: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statNum: { color: colors.text, fontWeight: '800', fontSize: 20 },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  walletCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: colors.accentDim,
  },
  walletLabel: { color: colors.textDim, fontSize: 12 },
  walletAmount: { color: colors.accent, fontSize: 32, fontWeight: '800', marginTop: 4 },
  walletLifetime: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  walletNote: { color: colors.textDim, fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  bigBtnEmoji: { fontSize: 28 },
  bigBtnTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  bigBtnSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
})
