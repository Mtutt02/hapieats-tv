import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileVisibility, allowComments, showInSearch } = await req.json()

  const { error } = await supabase
    .from('profiles')
    .update({
      profile_visibility: profileVisibility,
      allow_comments: allowComments,
      show_in_search: showInSearch,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
