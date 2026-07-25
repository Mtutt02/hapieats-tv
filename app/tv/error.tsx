'use client'

export default function TVError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('TV page error:', error)
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white px-4">
      <div className="max-w-md text-center">
        <span className="text-7xl block mb-4">📺</span>
        <h1 className="text-2xl font-bold mb-2">TV Signal Lost</h1>
        <p className="text-zinc-400 text-sm mb-6">
          We&apos;re having trouble tuning in. Try refreshing the channel.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          ↻ Tune Again
        </button>
      </div>
    </div>
  )
}
