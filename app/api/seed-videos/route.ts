import { NextResponse } from 'next/server'

// Retired seeding utility. It previously allowed unauthenticated service-role
// writes (create / mass-delete / reassign videos) — permanently disabled.
const gone = () => NextResponse.json({ error: 'Gone' }, { status: 410 })

export async function GET() { return gone() }
export async function POST() { return gone() }
export async function PATCH() { return gone() }
export async function DELETE() { return gone() }
