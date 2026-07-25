import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: NextRequest) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 30%, #16213e 70%, #0f3460 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'rgba(201, 168, 76, 0.04)',
            border: '1px solid rgba(201, 168, 76, 0.08)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(201, 168, 76, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: '#c9a84c',
            }}
          >
            H
          </div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#ffffff',
            }}
          >
            HapiEats TV
          </span>
        </div>

        {/* Main text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 800,
            padding: '0 40px',
          }}
        >
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: '-1px',
              lineHeight: 1.1,
              textAlign: 'center',
              color: '#ffffff',
              margin: 0,
              marginBottom: 16,
            }}
          >
            Good Food.{'\n'}Real People.{'\n'}Real Stories.
          </h1>
          <p
            style={{
              fontSize: 22,
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
              maxWidth: 600,
            }}
          >
            Watch food creators, catch live streams, take cooking classes
          </p>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            gap: 24,
            alignItems: 'center',
          }}
        >
          {['Live Cooking', 'Recipes', 'Classes', 'Food Creators'].map(label => (
            <span
              key={label}
              style={{
                fontSize: 14,
                color: 'rgba(201, 168, 76, 0.6)',
                letterSpacing: '0.5px',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
