import { NextResponse } from 'next/server';

// Remotion rendering requires native binaries (FFmpeg, compositor) unavailable in serverless.
// No render worker is connected, so this answers honestly: 503 + a stable code the UI can show.
// The Studio editor's in-browser Export (components/studio/editor/ExportDialog) is unaffected.

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: 'render_offline',
      error: 'Rendering is offline right now, try again later.',
    },
    { status: 503, headers: { 'Retry-After': '3600' } },
  );
}
