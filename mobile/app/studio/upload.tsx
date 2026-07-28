import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { colors, radius } from '@/lib/theme'

interface UploadTicket {
  uploadUrl: string
  uploadId: string
  videoId?: string
}

export default function UploadScreen() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [progress, setProgress] = useState(0)

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    })
    if (!res.canceled && res.assets[0]) setVideoUri(res.assets[0].uri)
  }

  const upload = async () => {
    if (!title.trim()) return Alert.alert('Title required')
    if (!videoUri) return Alert.alert('Pick a video first')
    setPhase('uploading')
    setProgress(0)

    // 1. Create the video record + get a Mux direct-upload URL
    const ticket = await api<UploadTicket>('/api/mux/upload', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        visibility: 'public',
        pricingModel: 'free',
        postType: 'general',
      }),
    })
    if (!ticket.ok || !ticket.data?.uploadUrl) {
      setPhase('idle')
      return Alert.alert('Upload failed', ticket.error ?? 'Could not get an upload URL')
    }

    // 2. PUT the file to Mux (XHR for progress events)
    try {
      const blob = await (await fetch(videoUri)).blob()
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', ticket.data!.uploadUrl)
        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Mux returned ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(blob)
      })
    } catch (e) {
      setPhase('idle')
      return Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error')
    }

    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={s.doneTitle}>Upload complete</Text>
        <Text style={s.doneSub}>
          Mux is processing your video now — it will appear on your channel in a few minutes.
        </Text>
        <TouchableOpacity style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>Back to Studio</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity style={s.picker} onPress={pickVideo} disabled={phase === 'uploading'}>
        <Text style={{ fontSize: 32 }}>{videoUri ? '🎞' : '➕'}</Text>
        <Text style={s.pickerText}>{videoUri ? 'Video selected — tap to change' : 'Pick a video'}</Text>
      </TouchableOpacity>

      <TextInput
        style={s.input}
        placeholder="Title"
        placeholderTextColor={colors.textDim}
        value={title}
        onChangeText={setTitle}
        editable={phase !== 'uploading'}
      />
      <TextInput
        style={[s.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder="Description (optional)"
        placeholderTextColor={colors.textDim}
        value={description}
        onChangeText={setDescription}
        multiline
        editable={phase !== 'uploading'}
      />

      {phase === 'uploading' ? (
        <View style={s.progressWrap}>
          <View style={[s.progressBar, { width: `${progress}%` }]} />
          <Text style={s.progressText}>Uploading… {progress}%</Text>
        </View>
      ) : (
        <TouchableOpacity style={s.btn} onPress={upload}>
          <Text style={s.btnText}>Upload to HapiEats</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  picker: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.lg,
    alignItems: 'center', paddingVertical: 36, marginBottom: 16, backgroundColor: colors.surface,
  },
  pickerText: { color: colors.textDim, marginTop: 8 },
  input: {
    backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  btn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  progressWrap: {
    height: 44, backgroundColor: colors.surface, borderRadius: radius.md,
    overflow: 'hidden', justifyContent: 'center', marginTop: 8,
  },
  progressBar: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.accentDim },
  progressText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  doneTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 },
  doneSub: { color: colors.textDim, textAlign: 'center', marginTop: 8, marginBottom: 24 },
})
