import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import VideoCard from '@/components/VideoCard'
import { colors } from '@/lib/theme'
import type { Video } from '@/lib/types'

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('videos')
      .select(`
        id, channel_id, creator_id, title, description, mux_playback_id,
        thumbnail_url, duration, status, visibility, view_count, created_at, published_at,
        creator:creator_id ( id, username, display_name, avatar_url, is_creator, bio, platform_subscription_status )
      `)
      .eq('status', 'ready')
      .eq('visibility', 'public')
      .not('mux_playback_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(40)
    setVideos((data as unknown as Video[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={videos}
      keyExtractor={v => v.id}
      renderItem={({ item }) => <VideoCard video={item} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
      ListEmptyComponent={
        <Text style={{ color: colors.textDim, textAlign: 'center', marginTop: 48 }}>
          No videos yet — check back soon.
        </Text>
      }
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
})
