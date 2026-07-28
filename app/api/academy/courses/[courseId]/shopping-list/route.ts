import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildShoppingList, type Recipe, type ShoppingItem } from '@/lib/academy/types'

export const dynamic = 'force-dynamic'

// GET /api/academy/courses/[courseId]/shopping-list
// Aggregate all course recipes into a de-duplicated list, then merge the
// caller's per-item checked state (if signed in).
export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    const { data: recipeRows, error } = await service
      .from('lesson_recipes')
      .select('*')
      .eq('course_id', params.courseId)

    if (error) {
      console.error('[academy/shopping-list GET] DB error:', error)
      return NextResponse.json({ error: 'Failed to load shopping list' }, { status: 500 })
    }

    const recipes = (recipeRows ?? []) as unknown as Recipe[]
    const items: ShoppingItem[] = buildShoppingList(recipes)

    if (user) {
      const { data: checks } = await service
        .from('shopping_checklist')
        .select('item_key, checked')
        .eq('course_id', params.courseId)
        .eq('user_id', user.id)
      const checkedMap = new Map<string, boolean>()
      for (const c of checks ?? []) checkedMap.set(c.item_key, !!c.checked)
      for (const it of items) it.checked = checkedMap.get(it.key) ?? false
    }

    return NextResponse.json({ items })
  } catch (err) {
    console.error('[academy/shopping-list GET] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST /api/academy/courses/[courseId]/shopping-list — upsert one item's checked state.
export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { item_key?: string; checked?: boolean }
    const itemKey = typeof body.item_key === 'string' ? body.item_key.trim() : ''
    if (!itemKey) return NextResponse.json({ error: 'item_key required' }, { status: 400 })
    const checked = body.checked === true

    const service = createServiceClient()
    const { error } = await service
      .from('shopping_checklist')
      .upsert(
        { user_id: user.id, course_id: params.courseId, item_key: itemKey, checked, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,course_id,item_key' },
      )

    if (error) {
      console.error('[academy/shopping-list POST] DB error:', error)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, item_key: itemKey, checked })
  } catch (err) {
    console.error('[academy/shopping-list POST] Error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
