import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudioEditor from '@/components/studio/editor/StudioEditor'

export const metadata: Metadata = {
  title: 'Studio Editor — HapiEats TV',
  description:
    'The HapiEats TV Studio: a professional multi-track video editor with keyframe animation, transitions, AI captions, smart trim, background removal, and one-click publishing.',
}

export default async function EditorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/studio/editor')

  return <StudioEditor />
}
