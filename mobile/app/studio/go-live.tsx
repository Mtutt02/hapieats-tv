import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Share,
} from 'react-native'
import { router } from 'expo-router'
import { ApiVideoLiveStreamView, ApiVideoLiveStreamMethods } from '@api.video/react-native-livestream'
import { supabase } from '@/lib/supabase'
import { apiPost, apiGet } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'
import { colors, radius } from '@/lib/theme'

// Mux ingest endpoint — stream key comes from /api/livestreams/create
const MUX_RTMP = 'rtmps://global-live.mux.com:443/app'

interface CreatedStream {
  id: string
  stream_key: string
  mux_playback_id: string | null
  title: string
  error?: string
  upgrade_required?: boolean
}

interface OwnChannel { id: string; name: string }

export default function GoLive() {
  const { session } = useAuth()
  const [channels, setChannels] = useState<OwnChannel[]>([])
  const [channelId, setChannelId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [stream, setStream] = useState<CreatedStream | null>(null)
  const [phase, setPhase] = useState<'setup' | 'preview' | 'live'>('setup')
  const [busy, setBusy] = useState(false)
  const camRef = useRef<ApiVideoLiveStreamMethods>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('channels')
      .select('id, name')
      .eq('creator_id', session.user.id)
      .then(({ data }) => {
        const list = (data as OwnChannel[]) ?? []
        setChannels(list)
        if (list[0]) setChannelId(list[0].id)
      })
  }, [session])

  const createStream = async () => {
    if (!title.trim()) return Alert.alert('Give your stream a title')
    if (!channelId) return Alert.alert('No channel', 'Create a channel on hapieatstv.com first.')
    setBusy(true)
    const res = await apiPost<CreatedStream>('/api/livestreams/create', {
      title: title.trim(),
      channelId,
    })
    setBusy(false)
    if (!res.ok || !res.data?.stream_key) {
      if (res.data?.upgrade_required) {
        return Alert.alert('Creator Pro required', 'Upgrade to Creator Pro in the Profile tab to go live.')
      }
      return Alert.alert('Could not create stream', res.error ?? 'Try again.')
    }
    setStream(res.data)
    setPhase('preview')
  }

  const startBroadcast = () => {
    if (!stream) return
    try {
      camRef.current?.startStreaming(stream.stream_key, MUX_RTMP)
      setPhase('live')
    } catch (e) {
      Alert.alert('Broadcast failed', e instanceof Error ? e.message : 'Camera error')
    }
  }

  const stopBroadcast = async () => {
    try { camRef.current?.stopStreaming() } catch { /* ignore */ }
    if (stream) await apiPost(`/api/livestreams/${stream.id}`, { action: 'end' }).catch(() => {})
    router.back()
  }

  const shareKey = () => {
    if (!stream) return
    Share.share({
      message:
        `HapiEats stream key (keep private!)\n\nRTMP URL: ${MUX_RTMP}\nStream key: ${stream.stream_key}\n\n` +
        `Use these in OBS or Larix if you prefer streaming from another device.`,
    })
  }

  // ── Setup form ───────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <Text style={s.label}>Stream title</Text>
        <TextInput
          style={s.input}
          placeholder="What are you cooking today?"
          placeholderTextColor={colors.textDim}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={s.label}>Channel</Text>
        {channels.length === 0 ? (
          <Text style={{ color: colors.textDim, marginBottom: 12 }}>
            You need a channel first — create one at hapieatstv.com → Studio.
          </Text>
        ) : (
          channels.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[s.channelRow, channelId === c.id && s.channelRowActive]}
              onPress={() => setChannelId(c.id)}
            >
              <Text style={{ color: colors.text }}>{channelId === c.id ? '◉' : '○'}  {c.name}</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={s.btn} onPress={createStream} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continue to camera</Text>}
        </TouchableOpacity>

        <Text style={s.hint}>
          Requires a development or production build (not Expo Go) — the camera broadcaster is a native module.
        </Text>
      </ScrollView>
    )
  }

  // ── Camera preview / live ─────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ApiVideoLiveStreamView
        ref={camRef}
        style={{ flex: 1 }}
        camera="back"
        enablePinchedZoom
        video={{ fps: 30, resolution: '720p', bitrate: 2 * 1024 * 1024, gopDuration: 2 }}
        audio={{ bitrate: 128000, sampleRate: 44100, isStereo: true }}
        isMuted={false}
        onConnectionSuccess={() => {}}
        onConnectionFailed={reason => Alert.alert('Connection failed', String(reason))}
        onDisconnect={() => { if (phase === 'live') Alert.alert('Disconnected', 'The stream connection dropped.') }}
      />

      <View style={s.liveControls}>
        {phase === 'preview' ? (
          <>
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={startBroadcast}>
              <Text style={s.btnText}>🔴 Start broadcasting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.smallBtn} onPress={shareKey}>
              <Text style={{ color: colors.text, fontSize: 12 }}>OBS key</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[s.btn, { flex: 1, backgroundColor: colors.live }]}
            onPress={() =>
              Alert.alert('End stream?', 'Your viewers will be disconnected.', [
                { text: 'Keep streaming' },
                { text: 'End stream', style: 'destructive', onPress: stopBroadcast },
              ])
            }
          >
            <Text style={s.btnText}>⏹ End stream</Text>
          </TouchableOpacity>
        )}
      </View>

      {phase === 'live' && (
        <View style={s.liveIndicator}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>● LIVE</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  channelRow: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  channelRowActive: { borderColor: colors.accent },
  btn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 15, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 16, fontStyle: 'italic' },
  liveControls: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    flexDirection: 'row', gap: 8, alignItems: 'center',
  },
  smallBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, padding: 12, marginTop: 20,
  },
  liveIndicator: {
    position: 'absolute', top: 48, left: 16, backgroundColor: colors.live,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
})
