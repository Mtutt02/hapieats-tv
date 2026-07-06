import { NextResponse } from 'next/server'

// Route removed — superadmin accounts are managed directly in Supabase.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
