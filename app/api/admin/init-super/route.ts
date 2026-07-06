import { NextResponse } from 'next/server'

// Route deleted after use — returns 410 Gone
export async function GET() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}
