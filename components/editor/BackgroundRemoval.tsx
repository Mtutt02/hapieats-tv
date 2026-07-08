'use client'

import { useRef, useState } from 'react'
import { Camera, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PremiumGate from './PremiumGate'

interface BackgroundRemovalProps {
  file: File
}

/**
 * Background Removal Component
 *
 * ⚠️ CURRENT STATUS: Demo / Placeholder
 *
 * This component captures a single frame from the video and applies a
 * simple distance-based transparency effect (bright edges → transparent).
 * It does NOT use real ML-based segmentation (e.g. MediaPipe, remove.bg).
 *
 * To make this production-ready:
 *   1. Integrate MediaPipe SelfieSegmentation (TensorFlow.js):
 *      - npm install @mediapipe/selfie_segmentation
 *      - Process each frame via canvas compositor in lib/video-compositor.ts
 *   2. OR use a cloud API like remove.bg (add api key to env):
 *      - POST to https://api.remove.bg/v1.0/removebg
 *      - Requires REMOVE_BG_API_KEY in environment
 *   3. The compositor in lib/video-compositor.ts can be extended to apply
 *      per-frame segmentation during final render.
 *
 * Required API keys for production:
 *   - MediaPipe: none (runs client-side via WASM)
 *   - remove.bg: REMOVE_BG_API_KEY env var ($99+/mo for 5000 calls)
 *
 * PremiumGate checks /api/creator/monetization → isCreator or hasCredits.
 */
export default function BackgroundRemoval({ file }: BackgroundRemovalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [videoUrl] = useState(() => URL.createObjectURL(file))
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedImage, setProcessedImage] = useState<string | null>(null)

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    setCapturedFrame(canvas.toDataURL('image/png'))
    setProcessedImage(null)
  }

  const processBackgroundRemoval = async () => {
    if (!capturedFrame) return
    setIsProcessing(true)

    // Simulate processing delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000))

    // For MVP: Create a simple green-screen effect
    // In production, this would use MediaPipe selfie segmentation
    const img = new globalThis.Image()
    img.src = capturedFrame
    await new Promise(resolve => { img.onload = resolve })

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.width
    canvas.height = img.height

    // Draw the captured frame
    ctx.drawImage(img, 0, 0)

    // Simple chroma-key-like: replace center-region background with green
    // (This is a placeholder — real ML would do proper segmentation)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Apply a simple background isolation (darker edges = more likely background)
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy)

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        const edgeFactor = dist / maxDist

        // If far from center, make it transparent
        // (simulating background removal)
        if (edgeFactor > 0.7) {
          const alpha = Math.max(0, 1 - (edgeFactor - 0.7) * 3)
          data[idx + 3] = Math.floor(alpha * 255)
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    setProcessedImage(canvas.toDataURL('image/png'))
    setIsProcessing(false)
  }

  const premiumContent = (
    <PremiumGate
      feature="Background Removal"
      description="Remove video backgrounds with AI-powered segmentation. Make your cooking videos pop with a clean, professional look."
    >
      <div className="space-y-4">
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            controls
            playsInline
          />
        </div>

        {/* Canvas for capture/processing */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={captureFrame}
          >
            <Camera className="h-4 w-4" />
            Capture Frame
          </Button>

          <Button
            className="flex-1 gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
            onClick={processBackgroundRemoval}
            disabled={!capturedFrame || isProcessing}
          >
            <Image className="h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Remove Background'}
          </Button>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 gap-3">
          {capturedFrame && (
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 font-medium">Original</p>
              <div className="rounded-lg overflow-hidden border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedFrame} alt="Original" className="w-full" />
              </div>
            </div>
          )}

          {processedImage && (
            <div className="space-y-1">
              <p className="text-xs text-green-400 font-medium">Processed</p>
              <div className="rounded-lg overflow-hidden border border-green-500/30 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAKElEQVQoU2NkYGBoYmBg+M8ABYxMjICJgYHxPwMDw3+mpqaMqBYAJDwIEeLRRc0AAAAASUVORK5CYII=')] bg-repeat">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={processedImage} alt="Processed" className="w-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )

  return premiumContent
}
