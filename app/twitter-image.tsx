import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 600 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'rgba(201, 168, 76, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              color: '#c9a84c',
            }}
          >
            H
          </div>
          <span style={{ fontSize: 48, fontWeight: 700, color: '#ffffff' }}>
            HapiEats TV
          </span>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)' }}>
            Good Food. Real People. Real Stories.
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
