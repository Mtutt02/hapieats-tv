import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0a0a0a',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Orange "H" mark */}
        <div
          style={{
            fontFamily: 'sans-serif',
            fontWeight: 900,
            fontSize: 22,
            color: '#22d3ee',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          H
        </div>
      </div>
    ),
    { ...size }
  )
}
