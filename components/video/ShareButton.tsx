'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Check } from 'lucide-react'

interface Props {
  videoId: string
  title: string
}

export default function ShareButton({ videoId, title }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/watch/${videoId}`

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // user cancelled or not supported — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard also failed — nothing we can do silently
    }
  }

  return (
    <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-500">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span className="text-xs">Share</span>
        </>
      )}
    </Button>
  )
}
