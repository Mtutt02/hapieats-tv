import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { supabase } from '@/lib/supabase'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'
import { colors, radius } from '@/lib/theme'
import { muxHls, type Video, type RecipeCard } from '@/lib/types'

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const [video, setVideo] = useState<Video | null>(null)
  const [recipe, setRecipe] = useState<RecipeCard | null>(null)
  const [liked, setLiked] = useState(false)
  const [tried, setTried] = useState(false)
  const [triedCount, setTriedCount] = useState(0)
  const [showRecipe, setShowRecipe] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [{ data: v }, { data: r }] = await Promise.all([
        supabase
          .from('videos')
          .select(`
            id, channel_id, creator_id, title, description, mux_playback_id, thumbnail_url,
            duration, status, visibility, view_count, created_at, published_at,
            creator:creator_id ( id, username, display_name, avatar_url, is_creator, bio, platform_subscription_status )
          `)
          .eq('id', id)
          .single(),
        supabase.from('recipe_cards').select('*').eq('video_id', id).maybeSingle(),
      ])
      setVideo((v as unknown as Video) ?? null)
      setRecipe((r as RecipeCard) ?? null)
      setLoading(false)
      // Record a view (fire-and-forget)
      supabase.rpc('increment_view_count', { p_video_id: id }).catch(() => {})
    })()
  }, [id])

  const player = useVideoPlayer(
    video?.mux_playback_id ? muxHls(video.mux_playback_id) : null,
    p => { p.play() }
  )

  // Source arrives after async load — replace explicitly
  useEffect(() => {
    if (video?.mux_playback_id) {
      player.replace(muxHls(video.mux_playback_id))
      player.play()
    }
  }, [video?.mux_playback_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLike = async () => {
    if (!session || !video) return
    setLiked(l => !l)
    await apiPost(`/api/videos/${video.id}/like`, {})
  }

  const toggleTried = async () => {
    if (!session || !video) return
    setTried(t => !t)
    setTriedCount(c => (tried ? c - 1 : c + 1))
    await apiPost(`/api/videos/${video.id}/tried`, {})
  }

  if (loading || !video) {
    return (
      <View style={s.center}>
        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <Text style={{ color: colors.textDim }}>Video not found</Text>}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: video.title }} />
      <View style={s.playerWrap}>
        {video.mux_playback_id ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" allowsFullscreen allowsPictureInPicture />
        ) : (
          <View style={s.center}><Text style={{ color: colors.textDim }}>Processing…</Text></View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={s.title}>{video.title}</Text>
        <Text style={s.meta}>
          {video.creator?.display_name ?? video.creator?.username} · {video.view_count} views
        </Text>

        <View style={s.actions}>
          <TouchableOpacity style={[s.action, liked && s.actionActive]} onPress={toggleLike}>
            <Text style={s.actionText}>{liked ? '❤️ Liked' : '🤍 Like'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.action, tried && s.actionActive]} onPress={toggleTried}>
            <Text style={s.actionText}>🍳 Tried this{triedCount > 0 ? ` (${triedCount})` : ''}</Text>
          </TouchableOpacity>
          {recipe && (
            <TouchableOpacity style={[s.action, showRecipe && s.actionActive]} onPress={() => setShowRecipe(r => !r)}>
              <Text style={s.actionText}>📖 Recipe</Text>
            </TouchableOpacity>
          )}
        </View>

        {showRecipe && recipe && (
          <View style={s.recipe}>
            <Text style={s.recipeTitle}>{recipe.title}</Text>
            {(recipe.cook_time_minutes || recipe.servings) && (
              <Text style={s.recipeMeta}>
                {recipe.cook_time_minutes ? `⏱ ${recipe.cook_time_minutes} min` : ''}
                {recipe.cook_time_minutes && recipe.servings ? '  ·  ' : ''}
                {recipe.servings ? `🍽 Serves ${recipe.servings}` : ''}
              </Text>
            )}
            <Text style={s.recipeH}>Ingredients</Text>
            {recipe.ingredients?.map((ing, i) => (
              <Text key={i} style={s.recipeLine}>• {ing}</Text>
            ))}
            <Text style={s.recipeH}>Steps</Text>
            {recipe.steps?.map((step, i) => (
              <Text key={i} style={s.recipeLine}>{i + 1}. {step}</Text>
            ))}
          </View>
        )}

        {video.description && <Text style={s.desc}>{video.description}</Text>}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  playerWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  action: {
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border,
  },
  actionActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  recipe: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  recipeTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  recipeMeta: { color: colors.textDim, marginTop: 4, fontSize: 13 },
  recipeH: { color: colors.accent, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  recipeLine: { color: colors.text, lineHeight: 22, fontSize: 14 },
  desc: { color: colors.textDim, marginTop: 16, lineHeight: 20 },
})
