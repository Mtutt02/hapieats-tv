import { NextResponse } from 'next/server'

// Bootstrap route has been used and disabled. Delete this file.
export async function POST() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}
