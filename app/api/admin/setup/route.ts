import { NextResponse } from 'next/server'

// Retired one-time bootstrap endpoint. It previously ran arbitrary SQL via the
// exec_sql RPC and could mint a superadmin. Schema is now managed only through
// versioned migrations in supabase/migrations. Permanently disabled.
const gone = () => NextResponse.json({ error: 'Gone' }, { status: 410 })

export async function POST() { return gone() }
export async function GET() { return gone() }
