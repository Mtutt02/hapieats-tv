import { NextResponse } from 'next/server'

// Route removed — real videos were already seeded. Use /api/admin/mux/sync to fix status.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
