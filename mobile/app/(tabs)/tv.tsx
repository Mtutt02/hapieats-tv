import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, FlatList, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useVideoPlayer, VideoView } from 'expo-video'
import { supabase } from '@/lib/supabase'
import { colors, radius } from '@/lib/theme'
import { muxHls, type TVChannel, type TVPlaylistItem } from '@/lib/types'

// Fixed station dial — mirrors app/tv/page.tsx on web. Keep in sync.
const STATION_DIAL = [
  'general', 'street-food', 'bbq', 'baking', 'desserts', 'italian',
  'japanese-kitchen', 'plant-based', 'travel', 'lifestyle', 'mukbang', 'food-reviews',
]

const OSD_TIMEOUT = 4500

export default function TVScreen() {
  const insets = useSafeAreaInsets()
  const [channels, setChannels] = useState<TVChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [osd, setOsd] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const osdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load channels (same shape as web TV page) ──────────────────────────────
  useEffect(() => {
    ;(async () => {
      const [{ data: stationRows }, { data: videoRows }, { data: liveStreams }] = await Promise.all([
        supabase.from('stations').select('id, slug, name, icon, description, theme').in('slug', STATION_DIAL),
        supabase
          .from('videos')
          .select('title, mux_playback_id, duration, station_id')
          .eq('status', 'ready').eq('visibility', 'public').eq('is_clip', false)
          .not('mux_playback_id', 'is', null)
          .order('published_at', { ascending: true }),
        supabase
          .from('live_streams')
          .select('id, title, mux_playback_id, channel:channels(name)')
          .eq('status', 'active').limit(10),
      ])

      const stations = stationRows ?? []
      const bySlug = new Map(stations.map(st => [st.slug, st]))
      const mainStageId = bySlug.get('general')?.id
      const playlists = new Map<string, TVPlaylistItem[]>()
      for (const v of videoRows ?? []) {
        if (!v.mux_playback_id) continue
        const key = v.station_id ?? mainStageId
        if (!key) continue
        const list = playlists.get(key) ?? []
        list.push({ title: v.title, muxPlaybackId: v.mux_playback_id, duration: v.duration ?? null })
        playlists.set(key, list)
      }

      const chans: TVChannel[] = []
      STATION_DIAL.forEach((slug, i) => {
        const st = bySlug.get(slug)
        if (!st) return
        const playlist = playlists.get(st.id) ?? []
        chans.push({
          number: i + 1,
          name: st.name,
          icon: st.icon ?? '📺',
          description: st.description ?? '',
          category: st.theme ?? 'Community',
          currentTitle: playlist[0]?.title ?? 'Off Air',
          playlist,
        })
      })
      let liveNum = 90
      for (const ls of liveStreams ?? []) {
        if (!ls.mux_playback_id) continue
        chans.push({
          number: liveNum++,
          name: (ls.channel as unknown as { name: string } | null)?.name ?? 'Live Channel',
          icon: '📡',
          description: 'Live right now',
          category: 'LIVE',
          currentTitle: ls.title,
          muxPlaybackId: ls.mux_playback_id,
          isLive: true,
        })
      }
      setChannels(chans)
      setLoading(false)
    })()
  }, [])

  const channel = channels[idx]
  const [playlistIdx, setPlaylistIdx] = useState(0)

  const currentPlaybackId = useMemo(() => {
    if (!channel) return null
    if (channel.isLive && channel.muxPlaybackId) return channel.muxPlaybackId
    return channel.playlist?.[playlistIdx % Math.max(channel.playlist.length, 1)]?.muxPlaybackId ?? null
  }, [channel, playlistIdx])

  const player = useVideoPlayer(currentPlaybackId ? muxHls(currentPlaybackId) : null, p => {
    p.loop = false
    p.play()
  })

  // expo-video doesn't swap sources on prop change — replace explicitly
  useEffect(() => {
    if (currentPlaybackId) {
      player.replace(muxHls(currentPlaybackId))
      player.play()
    }
  }, [currentPlaybackId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { player.muted = muted }, [muted, player])

  // Auto-advance playlist when a VOD item ends
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (channel && !channel.isLive && (channel.playlist?.length ?? 0) > 1) {
        setPlaylistIdx(i => i + 1)
      } else {
        player.replay()
      }
    })
    return () => sub.remove()
  }, [player, channel])

  // ── OSD auto-hide ──────────────────────────────────────────────────────────
  const showOsd = useCallback(() => {
    setOsd(true)
    if (osdTimer.current) clearTimeout(osdTimer.current)
    osdTimer.current = setTimeout(() => setOsd(false), OSD_TIMEOUT)
  }, [])
  useEffect(() => { showOsd() }, [idx, showOsd])

  // ── Channel switching with flash animation ─────────────────────────────────
  const changeChannel = useCallback((dir: 1 | -1) => {
    if (channels.length === 0) return
    setSwitching(true)
    setTimeout(() => {
      setIdx(i => (i + dir + channels.length) % channels.length)
      setPlaylistIdx(0)
      setSwitching(false)
    }, 300)
  }, [channels.length])

  const tuneTo = useCallback((target: number) => {
    const i = channels.findIndex(c => c.number === target)
    if (i === -1) return
    setSwitching(true)
    setGuideOpen(false)
    setTimeout(() => {
      setIdx(i)
      setPlaylistIdx(0)
      setSwitching(false)
    }, 300)
  }, [channels])

  // Swipe up = channel up, swipe down = channel down, tap = OSD
  const fling = Gesture.Pan()
    .minDistance(40)
    .onEnd(e => {
      'worklet'
      if (Math.abs(e.translationY) > Math.abs(e.translationX)) {
        if (e.translationY < -40) runOnJS(changeChannel)(1)
        else if (e.translationY > 40) runOnJS(changeChannel)(-1)
      }
    })
  const tap = Gesture.Tap().onEnd(() => {
    'worklet'
    runOnJS(showOsd)()
  })
  const gestures = Gesture.Exclusive(fling, tap)

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textDim, marginTop: 12 }}>Warming up the tubes…</Text>
      </View>
    )
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <GestureDetector gesture={gestures}>
        <View style={s.screen}>
          {currentPlaybackId ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture
            />
          ) : (
            <View style={s.offAir}>
              <Text style={{ fontSize: 48 }}>📺</Text>
              <Text style={s.offAirText}>OFF AIR</Text>
            </View>
          )}

          {/* Channel-switch flash */}
          {switching && (
            <View style={s.flash}>
              <Text style={s.flashNum}>CH {String(channel?.number ?? 0).padStart(2, '0')}</Text>
            </View>
          )}

          {/* OSD */}
          {osd && channel && !switching && (
            <View style={s.osd} pointerEvents="none">
              <Text style={s.osdNum}>
                CH {String(channel.number).padStart(2, '0')} {channel.icon}
              </Text>
              <Text style={s.osdName}>{channel.name}</Text>
              <Text style={s.osdTitle} numberOfLines={1}>
                {channel.isLive ? '🔴 LIVE — ' : 'Now playing: '}
                {channel.isLive
                  ? channel.currentTitle
                  : channel.playlist?.[playlistIdx % Math.max(channel.playlist.length, 1)]?.title ?? 'Off Air'}
              </Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Control bar */}
      <View style={[s.controls, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={s.ctl} onPress={() => changeChannel(-1)}>
          <Text style={s.ctlText}>CH −</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctl} onPress={() => setMuted(m => !m)}>
          <Text style={s.ctlText}>{muted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ctl, s.ctlAccent]} onPress={() => setGuideOpen(true)}>
          <Text style={[s.ctlText, { color: '#fff' }]}>GUIDE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctl} onPress={() => player.playing ? player.pause() : player.play()}>
          <Text style={s.ctlText}>⏯</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctl} onPress={() => changeChannel(1)}>
          <Text style={s.ctlText}>CH +</Text>
        </TouchableOpacity>
      </View>

      {/* Guide */}
      <Modal visible={guideOpen} animationType="slide" transparent onRequestClose={() => setGuideOpen(false)}>
        <View style={s.guideBackdrop}>
          <View style={[s.guide, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.guideHeader}>
              <Text style={s.guideTitle}>📋 Channel Guide</Text>
              <TouchableOpacity onPress={() => setGuideOpen(false)}>
                <Text style={{ color: colors.textDim, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={channels}
              keyExtractor={c => String(c.number)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.guideRow, item.number === channel?.number && s.guideRowActive]}
                  onPress={() => tuneTo(item.number)}
                >
                  <Text style={s.guideNum}>{String(item.number).padStart(2, '0')}</Text>
                  <Text style={{ fontSize: 18, marginRight: 8 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.guideName}>{item.name}</Text>
                    <Text style={s.guideNow} numberOfLines={1}>{item.currentTitle}</Text>
                  </View>
                  {item.isLive && <Text style={s.liveBadge}>LIVE</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const { height: H } = Dimensions.get('window')

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: '#000' },
  offAir: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offAirText: { color: colors.textDim, letterSpacing: 6, marginTop: 8, fontWeight: '700' },
  flash: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#000',
    alignItems: 'flex-end', justifyContent: 'flex-start', padding: 24,
  },
  flashNum: { color: colors.success, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  osd: {
    position: 'absolute', top: 16, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.md, padding: 12,
  },
  osdNum: { color: colors.success, fontWeight: '800', fontSize: 20 },
  osdName: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 2 },
  osdTitle: { color: '#d4d4d4', fontSize: 13, marginTop: 2 },
  controls: {
    flexDirection: 'row', gap: 8, padding: 8,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  ctl: {
    flex: 1, backgroundColor: colors.surfaceHi, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  ctlAccent: { backgroundColor: colors.accent },
  ctlText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  guideBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  guide: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: H * 0.66, paddingTop: 8,
  },
  guideHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  guideTitle: { color: colors.text, fontWeight: '800', fontSize: 17 },
  guideRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  guideRowActive: { backgroundColor: colors.surfaceHi },
  guideNum: { color: colors.success, fontWeight: '800', width: 34, fontVariant: ['tabular-nums'] },
  guideName: { color: colors.text, fontWeight: '600' },
  guideNow: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  liveBadge: {
    color: '#fff', backgroundColor: colors.live, fontSize: 10, fontWeight: '800',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
})
