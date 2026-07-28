import { NextResponse } from 'next/server'

// Route removed — use /api/admin/mux/sync (requires proper admin session, no bypass secret).
export async function POST() {
  return NextResponse.json({ error: 'Not found. Use /api/admin/mux/sync instead.' }, { status: 404 })
}
