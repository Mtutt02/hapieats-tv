import { NextResponse } from 'next/server';

// Remotion rendering requires native binaries (FFmpeg, compositor) unavailable in serverless.
// This endpoint is a placeholder — connect to a dedicated render worker.
// The editor UI works 100% client-side (templates, clips, audio, timeline).

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Render service offline. Connect Remotion via cloud worker or dedicated server.',
  });
}
