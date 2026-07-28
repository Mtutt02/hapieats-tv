import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { supabase } from '@/lib/supabase'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'
import GiftSheet from '@/components/GiftSheet'
import { colors, radius } from '@/lib/theme'
import { muxHls, type LiveStream, type ChatMessage, type LiveGift } from '@/lib/types'

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { session, profile } = useAuth()

  const [stream, setStream] = useState<LiveStream | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [gifts, setGifts] = useState<LiveGift[]>([])
  const [balance, setBalance] = useState(0)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [giftsOpen, setGiftsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const listRef = useRef<FlatList>(null)
  // Profile cache — avoids re-fetch per message (mirrors web LiveRoomClient useRef pattern)
  const profileCache = useRef<Map<string, ChatMessage['sender']>>(new Map())

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [{ data: st }, { data: msgs }, giftsRes, balRes] = await Promise.all([
        supabase
          .from('live_streams')
          .select(`
            id, channel_id, creator_id, title, description, mux_playback_id, status, viewer_count,
            creator:creator_id ( id, username, display_name, avatar_url, is_creator, bio, platform_subscription_status )
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('live_chat_messages')
          .select(`
            id, stream_id, sender_id, message, type, gift_name, gift_emoji, gift_tokens, is_private, created_at,
            sender:sender_id ( username, display_name, avatar_url )
          `)
          .eq('stream_id', id)
          .eq('is_private', false)
          .order('created_at', { ascending: false })
          .limit(60),
        apiGet<LiveGift[]>('/api/live/gift'),
        supabase.from('hapi_tokens').select('balance').maybeSingle(),
      ])
      setStream((st as unknown as LiveStream) ?? null)
      setMessages(((msgs as unknown as ChatMessage[]) ?? []).reverse())
      setGifts(giftsRes.data ?? [])
      setBalance((balRes.data as { balance: number } | null)?.balance ?? 0)
      setLoading(false)
    })()
  }, [id])

  // ── Realtime chat — same channel name as web: live_chat:${stream.id} ───────
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`live_chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${id}` },
        async payload => {
          const msg = payload.new as ChatMessage
          if (msg.is_private) return
          // hydrate sender from cache or fetch
          let sender = profileCache.current.get(msg.sender_id) ?? null
          if (!sender) {
            const { data } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', msg.sender_id)
              .single()
            sender = (data as ChatMessage['sender']) ?? null
            if (sender) profileCache.current.set(msg.sender_id, sender)
          }
          setMessages(prev =>
            prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, sender }]
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [messages.length])

  const player = useVideoPlayer(
    stream?.mux_playback_id ? muxHls(stream.mux_playback_id) : null,
    p => { p.play() }
  )

  // Source arrives after async load — replace explicitly
  useEffect(() => {
    if (stream?.mux_playback_id && stream.status !== 'ended') {
      player.replace(muxHls(stream.mux_playback_id))
      player.play()
    }
  }, [stream?.mux_playback_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send chat ──────────────────────────────────────────────────────────────
  const sendChat = useCallback(async () => {
    const text = input.trim()
    if (!text || !session || !id || sending) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('live_chat_messages').insert({
      stream_id: id,
      sender_id: session.user.id,
      message: text.slice(0, 500),
      type: 'message',
      is_private: false,
    })
    setSending(false)
    if (error) Alert.alert('Could not send', error.message)
  }, [input, session, id, sending])

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  }
  if (!stream) {
    return <View style={s.center}><Text style={{ color: colors.textDim }}>Stream not found</Text></View>
  }

  const ended = stream.status === 'ended'
  const isCreator = session?.user.id === stream.creator_id

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Player */}
      <View style={s.playerWrap}>
        {stream.mux_playback_id && !ended ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        ) : (
          <View style={s.center}>
            <Text style={{ fontSize: 40 }}>{ended ? '🏁' : '⏳'}</Text>
            <Text style={{ color: colors.textDim, marginTop: 8 }}>
              {ended ? 'This stream has ended' : 'Waiting for the stream to start…'}
            </Text>
          </View>
        )}
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.streamInfo}>
          {!ended && <Text style={s.liveBadge}>● LIVE</Text>}
          <Text style={s.streamTitle} numberOfLines={1}>{stream.title}</Text>
          <Text style={s.streamCreator}>
            {stream.creator?.display_name ?? stream.creator?.username} · {stream.viewer_count} watching
          </Text>
        </View>
      </View>

      {/* Chat */}
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => {
          if (item.type === 'gift_event') {
            return (
              <View style={s.giftMsg}>
                <Text style={s.giftMsgText}>
                  {item.gift_emoji} {item.sender?.display_name ?? item.sender?.username ?? 'Someone'}{' '}
                  {item.message} (🪙 {item.gift_tokens})
                </Text>
              </View>
            )
          }
          return (
            <View style={s.msg}>
              <Text style={s.msgSender}>
                {item.sender?.display_name ?? item.sender?.username ?? 'viewer'}
                <Text style={s.msgBody}>  {item.message}</Text>
              </Text>
            </View>
          )
        }}
      />

      {/* Input row */}
      <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={s.input}
          placeholder={session ? 'Say something…' : 'Sign in to chat'}
          placeholderTextColor={colors.textDim}
          value={input}
          onChangeText={setInput}
          editable={!!session}
          onSubmitEditing={sendChat}
          returnKeyType="send"
        />
        <TouchableOpacity style={s.iconBtn} onPress={sendChat} disabled={sending || !input.trim()}>
          <Text style={{ fontSize: 18 }}>➤</Text>
        </TouchableOpacity>
        {!isCreator && (
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.accent }]} onPress={() => setGiftsOpen(true)}>
            <Text style={{ fontSize: 18 }}>🎁</Text>
          </TouchableOpacity>
        )}
      </View>

      <GiftSheet
        visible={giftsOpen}
        onClose={() => setGiftsOpen(false)}
        streamId={stream.id}
        gifts={gifts}
        balance={balance}
        onSent={b => { if (b != null) setBalance(b) }}
        onNeedTokens={() => {
          setGiftsOpen(false)
          Alert.alert('Not enough tokens', 'Top up your Hapi Tokens from the Profile tab.', [
            { text: 'Later' },
            { text: 'Get tokens', onPress: () => router.push('/(tabs)/profile') },
          ])
        }}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  playerWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  back: {
    position: 'absolute', top: 8, left: 12, backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  streamInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  liveBadge: { color: colors.live, fontWeight: '800', fontSize: 11 },
  streamTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  streamCreator: { color: '#d4d4d4', fontSize: 11, marginTop: 1 },
  msg: { marginBottom: 8 },
  msgSender: { color: colors.accent, fontWeight: '700', fontSize: 13, lineHeight: 19 },
  msgBody: { color: colors.text, fontWeight: '400' },
  giftMsg: {
    backgroundColor: colors.surfaceHi, borderRadius: radius.md, padding: 8, marginBottom: 8,
    borderWidth: 1, borderColor: colors.accentDim,
  },
  giftMsgText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  inputRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceHi, color: colors.text,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
})
