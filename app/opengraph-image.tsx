import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'HapiEats TV — Good Food. Real People. Real Stories.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#09090b',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 90,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Subtle emerald glow behind the mark */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: 60,
            width: 520,
            height: 430,
            background: 'radial-gradient(ellipse, rgba(16,185,129,0.18) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Bottom gradient strip — emerald → teal */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: 'linear-gradient(90deg, #059669, #10b981, #2dd4bf, #10b981, #059669)',
          }}
        />

        {/* Left: TV + HE mark */}
        <div
          style={{
            width: 320,
            height: 320,
            position: 'relative',
            display: 'flex',
          }}
        >
          {/* Left antenna */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 130,
              width: 10,
              height: 52,
              background: '#10b981',
              borderRadius: 5,
              transform: 'rotate(-32deg)',
            }}
          />
          {/* Right antenna */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 180,
              width: 10,
              height: 52,
              background: '#10b981',
              borderRadius: 5,
              transform: 'rotate(32deg)',
            }}
          />
          {/* TV body — gradient screen with HE */}
          <div
            style={{
              position: 'absolute',
              top: 68,
              left: 30,
              width: 260,
              height: 190,
              borderRadius: 36,
              background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1,
                letterSpacing: '-3px',
              }}
            >
              HE
            </div>
          </div>
          {/* Left foot */}
          <div
            style={{
              position: 'absolute',
              top: 258,
              left: 85,
              width: 16,
              height: 26,
              background: '#10b981',
              borderRadius: 6,
            }}
          />
          {/* Right foot */}
          <div
            style={{
              position: 'absolute',
              top: 258,
              left: 219,
              width: 16,
              height: 26,
              background: '#10b981',
              borderRadius: 6,
            }}
          />
        </div>

        {/* Right: wordmark + tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
            }}
          >
            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                letterSpacing: '-3px',
                lineHeight: 1,
                color: '#ffffff',
              }}
            >
              HapiEats
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                letterSpacing: '-3px',
                lineHeight: 1,
                marginLeft: 20,
                backgroundImage: 'linear-gradient(90deg, #10b981, #2dd4bf)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              TV
            </div>
          </div>
          <div
            style={{
              fontSize: 30,
              color: '#a1a1aa',
              letterSpacing: '0.5px',
            }}
          >
            Good Food. Real People. Real Stories.
          </div>
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 36,
            fontSize: 18,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.5px',
          }}
        >
          hapieatstv.com
        </div>
      </div>
    ),
    { ...size }
  )
}
