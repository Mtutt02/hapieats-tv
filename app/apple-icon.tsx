import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(145deg, #0b0d11 0%, #0e1a26 100%)',
          borderRadius: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}
      >
        {/* Cyan "H" */}
        <div
          style={{
            fontFamily: 'sans-serif',
            fontWeight: 900,
            fontSize: 110,
            color: '#22d3ee',
            lineHeight: 1,
            letterSpacing: '-4px',
          }}
        >
          H
        </div>
      </div>
    ),
    { ...size }
  )
}
