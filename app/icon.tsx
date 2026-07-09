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
          background: '#09090b',
          borderRadius: 6,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Left antenna */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: 12,
            width: 2,
            height: 7,
            background: '#10b981',
            borderRadius: 1,
            transform: 'rotate(-35deg)',
          }}
        />
        {/* Right antenna */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: 18,
            width: 2,
            height: 7,
            background: '#10b981',
            borderRadius: 1,
            transform: 'rotate(35deg)',
          }}
        />
        {/* TV body with HE */}
        <div
          style={{
            position: 'absolute',
            top: 7,
            left: 3,
            width: 26,
            height: 18,
            border: '2px solid #10b981',
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'sans-serif',
              fontWeight: 900,
              fontSize: 9,
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            HE
          </div>
        </div>
        {/* Left foot */}
        <div
          style={{
            position: 'absolute',
            top: 25,
            left: 8,
            width: 3,
            height: 4,
            background: '#10b981',
            borderRadius: 1,
          }}
        />
        {/* Right foot */}
        <div
          style={{
            position: 'absolute',
            top: 25,
            left: 21,
            width: 3,
            height: 4,
            background: '#10b981',
            borderRadius: 1,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
