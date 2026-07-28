import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors, radius } from '@/lib/theme'
import { muxThumb, type LiveStream } from '@/lib/types'

export default function LiveTab() {
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('live_streams')
      .select(`
        id, channel_id, creator_id, title, description, mux_playback_id, status, viewer_count,
        creator:creator_id ( id, username, display_name, avatar_url, is_creator, bio, platform_subscription_status ),
        channel:channel_id ( id, creator_id, name, slug, thumbnail_url )
      `)
      .eq('status', 'active')
      .order('viewer_count', { ascending: false })
    setStreams((data as unknown as LiveStream[]) ?? [])
  }, [])

  useEffect(() => {
    load()
    // Refresh the list when streams start/end
    const channel = supabase
      .channel('live_streams_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={streams}
      keyExtractor={sIt => sIt.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
          tintColor={colors.accent}
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => router.push(`/live-room/${item.id}`)}>
          <View style={s.thumbWrap}>
            {item.mux_playback_id ? (
              <Image source={{ uri: muxThumb(item.mux_playback_id) }} style={s.thumb} contentFit="cover" />
            ) : (
              <View style={[s.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 32 }}>📡</Text>
              </View>
            )}
            <View style={s.liveBadge}><Text style={s.liveBadgeText}>● LIVE</Text></View>
            <View style={s.viewers}><Text style={s.viewersText}>{item.viewer_count} watching</Text></View>
          </View>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          <Text style={s.meta}>
            {item.creator?.display_name ?? item.creator?.username} · {item.channel?.name ?? ''}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', marginTop: 64 }}>
          <Text style={{ fontSize: 40 }}>😴</Text>
          <Text style={{ color: colors.textDim, marginTop: 8 }}>Nobody is live right now.</Text>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Pull to refresh</Text>
        </View>
      }
    />
  )
}

const s = StyleSheet.create({
  card: { marginBottom: 20 },
  thumbWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  liveBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.live,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  liveBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  viewers: {
    position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  viewersText: { color: '#fff', fontSize: 11 },
  title: { color: colors.text, fontWeight: '600', fontSize: 15, marginTop: 8 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
})
