import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator, Alert } from 'react-native'
import { apiPost } from '@/lib/api'
import { colors, radius } from '@/lib/theme'
import type { LiveGift } from '@/lib/types'

interface GiftResponse {
  success: boolean
  remaining_balance: number | null
  error?: string
  code?: string
}

interface Props {
  visible: boolean
  onClose: () => void
  streamId: string
  gifts: LiveGift[]
  balance: number
  onSent: (newBalance: number | null) => void
  onNeedTokens: () => void
}

export default function GiftSheet({ visible, onClose, streamId, gifts, balance, onSent, onNeedTokens }: Props) {
  const [sending, setSending] = useState<string | null>(null)

  const send = async (gift: LiveGift) => {
    if (balance < gift.token_cost) {
      onNeedTokens()
      return
    }
    setSending(gift.id)
    const res = await apiPost<GiftResponse>('/api/live/gift', {
      stream_id: streamId,
      gift_id: gift.id,
      quantity: 1,
    })
    setSending(null)
    if (!res.ok) {
      if (res.status === 402) onNeedTokens()
      else Alert.alert('Gift failed', res.error ?? 'Please try again.')
      return
    }
    onSent(res.data?.remaining_balance ?? null)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>🎁 Send a gift</Text>
            <Text style={s.balance}>🪙 {balance}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textDim, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={gifts}
            keyExtractor={g => g.id}
            numColumns={4}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.gift, balance < item.token_cost && { opacity: 0.4 }]}
                onPress={() => send(item)}
                disabled={sending !== null}
              >
                {sending === item.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
                    <Text style={s.giftName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.giftCost}>🪙 {item.token_cost}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '55%', paddingBottom: 24,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 },
  balance: { color: colors.accent, fontWeight: '700' },
  gift: {
    flex: 1 / 4, alignItems: 'center', paddingVertical: 12, margin: 4,
    backgroundColor: colors.surfaceHi, borderRadius: radius.md,
  },
  giftName: { color: colors.text, fontSize: 11, marginTop: 4 },
  giftCost: { color: colors.textDim, fontSize: 10, marginTop: 2 },
})
