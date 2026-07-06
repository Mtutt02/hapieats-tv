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
          background: '#0b0d11',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(34,211,238,0.16) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Bottom gradient strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #0891b2, #22d3ee, #67e8f9, #22d3ee, #0891b2)',
          }}
        />

        {/* Logo icon — fork + play on cyan */}
        <div
          style={{
            width: 80,
            height: 80,
            background: 'rgba(34,211,238,0.12)',
            border: '2px solid rgba(34,211,238,0.4)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 900, color: '#22d3ee', lineHeight: 1 }}>H</div>
        </div>

        {/* Brand name — matching logo wordmark */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <span style={{ color: '#22d3ee' }}>HAPI</span>
          <span style={{ color: '#ffffff' }}>EATS</span>
          <span style={{ color: '#f0147e', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}> TV</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#94a3b8',
            letterSpacing: '0.5px',
            marginBottom: 48,
          }}
        >
          Good Food. Real People. Real Stories.
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['🎬 Watch', '📡 Live Streams', '👨‍🍳 Food Creators', '🍕 Free & Premium'].map(label => (
            <div
              key={label}
              style={{
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.25)',
                borderRadius: 100,
                padding: '10px 22px',
                fontSize: 18,
                color: '#a5f3fc',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 36,
            fontSize: 18,
            color: 'rgba(255,255,255,0.2)',
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
