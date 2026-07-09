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
          background: '#09090b',
          borderRadius: 40,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Left antenna */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: 74,
            width: 5,
            height: 22,
            background: '#10b981',
            borderRadius: 3,
            transform: 'rotate(-32deg)',
          }}
        />
        {/* Right antenna */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: 101,
            width: 5,
            height: 22,
            background: '#10b981',
            borderRadius: 3,
            transform: 'rotate(32deg)',
          }}
        />
        {/* TV body — emerald→teal gradient screen with HE */}
        <div
          style={{
            position: 'absolute',
            top: 46,
            left: 34,
            width: 112,
            height: 82,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'sans-serif',
              fontWeight: 900,
              fontSize: 42,
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-1px',
            }}
          >
            HE
          </div>
        </div>
        {/* Left foot */}
        <div
          style={{
            position: 'absolute',
            top: 128,
            left: 58,
            width: 7,
            height: 12,
            background: '#10b981',
            borderRadius: 3,
          }}
        />
        {/* Right foot */}
        <div
          style={{
            position: 'absolute',
            top: 128,
            left: 115,
            width: 7,
            height: 12,
            background: '#10b981',
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
