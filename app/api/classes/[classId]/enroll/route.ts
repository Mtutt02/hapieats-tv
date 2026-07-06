import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check class exists and is published
  const { data: cls } = await supabase
    .from('classes')
    .select('id, price, max_students, enrollment_count, is_published')
    .eq('id', params.classId)
    .single()

  if (!cls || !cls.is_published) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  if (cls.max_students && cls.enrollment_count >= cls.max_students) {
    return NextResponse.json({ error: 'Class is full' }, { status: 409 })
  }
  if (cls.price > 0) {
    return NextResponse.json({ error: 'Paid enrollment requires Stripe checkout', requiresPayment: true }, { status: 402 })
  }

  const { data, error } = await supabase
    .from('class_enrollments')
    .insert({ class_id: params.classId, user_id: user.id, status: 'active' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already enrolled' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
