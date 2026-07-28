import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { muxThumb, type Video } from '@/lib/types'
import { colors, radius } from '@/lib/theme'

function fmtDuration(sec: number | null) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoCard({ video }: { video: Video }) {
  const thumb =
    video.thumbnail_url ??
    (video.mux_playback_id ? muxThumb(video.mux_playback_id) : null)

  return (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/watch/${video.id}`)}>
      <View style={s.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" transition={150} />
        ) : (
          <View style={[s.thumb, s.thumbEmpty]}>
            <Text style={{ fontSize: 32 }}>🍳</Text>
          </View>
        )}
        {video.duration != null && (
          <View style={s.duration}>
            <Text style={s.durationText}>{fmtDuration(video.duration)}</Text>
          </View>
        )}
      </View>
      <Text style={s.title} numberOfLines={2}>{video.title}</Text>
      <Text style={s.meta} numberOfLines={1}>
        {video.creator?.display_name ?? video.creator?.username ?? 'HapiEats'} · {video.view_count} views
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: { marginBottom: 20 },
  thumbWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  duration: {
    position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  title: { color: colors.text, fontWeight: '600', fontSize: 15, marginTop: 8 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
})
