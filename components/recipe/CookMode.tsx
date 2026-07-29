'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, Play, Pause, Timer, ChefHat, Clock } from 'lucide-react'

interface CookStep {
  id: string
  stepNumber: number
  instruction: string
  timestampSeconds?: number
  timerSeconds?: number
}

interface RecipeData {
  id: string
  title: string
  steps: CookStep[]
}

interface CookModeProps {
  isOpen: boolean
  onClose: () => void
  recipe: RecipeData | null
  muxPlaybackId: string
  onSeekTo?: (seconds: number) => void
  currentTime?: number
}

export default function CookMode({ isOpen, onClose, recipe, muxPlaybackId, onSeekTo, currentTime = 0 }: CookModeProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerComplete, setTimerComplete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<any>(null)

  // Wake lock
  useEffect(() => {
    if (!isOpen) return
    async function lock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        }
      } catch { /* browser doesn't support or denied */ }
    }
    lock()
    return () => {
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release() } catch { /* */ }
      }
    }
  }, [isOpen])

  // Timer logic
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerRunning(false)
            setTimerComplete(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning, timerSeconds])

  // Reset on step change
  useEffect(() => {
    setTimerRunning(false)
    setTimerComplete(false)
    const step = recipe?.steps[currentStep]
    setTimerSeconds(step?.timerSeconds ?? 0)
  }, [currentStep, recipe])

  const goToStep = useCallback((idx: number) => {
    if (!recipe) return
    if (idx < 0 || idx >= recipe.steps.length) return
    setCurrentStep(idx)
    const step = recipe.steps[idx]
    if (step.timestampSeconds != null && onSeekTo) {
      onSeekTo(step.timestampSeconds)
    }
  }, [recipe, onSeekTo])

  const toggleTimer = () => {
    if (timerComplete) {
      setTimerComplete(false)
      const step = recipe?.steps[currentStep]
      setTimerSeconds(step?.timerSeconds ?? 0)
    }
    setTimerRunning(prev => !prev)
  }

  if (!isOpen || !recipe) return null

  const step = recipe.steps[currentStep]
  const total = recipe.steps.length
  const progressPct = ((currentStep + 1) / total) * 100

  // Format timer display
  const minutes = Math.floor(timerSeconds / 60)
  const seconds = timerSeconds % 60

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors">
          <X className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-white/60 text-xs font-medium">Cook Mode</p>
          <p className="text-white/90 text-sm font-semibold truncate max-w-[200px]">{recipe.title}</p>
        </div>
        <div className="w-9" /> {/* spacer */}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 shrink-0">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main content: video placeholder + step */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Video area */}
        <div className="relative aspect-video bg-zinc-900 shrink-0">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-2">
                <Play className="h-7 w-7 text-white/40" />
              </div>
              <p className="text-white/40 text-xs">
                Video segment: {(step?.timestampSeconds ?? 0) / 60 | 0}:{String((step?.timestampSeconds ?? 0) % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>

        {/* Step display */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider">
              Step {currentStep + 1} of {total}
            </span>
            {step?.timerSeconds != null && step.timerSeconds > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-cyan-400 font-medium">
                <Timer className="h-3.5 w-3.5" />
                {step.timerSeconds}s timer
              </span>
            )}
          </div>

          {/* Step instruction */}
          <div className={cn(
            'p-5 rounded-2xl transition-all duration-300',
            timerComplete
              ? 'bg-green-500/10 border border-green-500/30 animate-pulse'
              : 'bg-white/5 border border-white/10',
          )}>
            <h2 className="text-lg font-bold text-white leading-relaxed">
              {step?.instruction}
            </h2>
          </div>

          {/* Timer display */}
          {(timerSeconds > 0 || timerComplete) && (
            <div className="text-center">
              <button
                onClick={toggleTimer}
                className={cn(
                  'w-32 h-32 rounded-full mx-auto flex flex-col items-center justify-center border-4 transition-all duration-300',
                  timerRunning
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 animate-pulse'
                    : timerComplete
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-white/20 bg-white/5 text-white/60',
                )}
              >
                <span className="text-3xl font-bold font-mono tracking-wider">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] mt-1 opacity-60">
                  {timerComplete ? 'Done!' : timerRunning ? 'Pause' : 'Start'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-4 py-4 gap-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentStep === 0}
          onClick={() => goToStep(currentStep - 1)}
          className="gap-1.5 text-white/60"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex gap-1.5">
          {recipe.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === currentStep
                  ? 'w-6 bg-cyan-500'
                  : i < currentStep
                  ? 'w-2 bg-cyan-500/40'
                  : 'w-2 bg-white/20',
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          disabled={currentStep === total - 1}
          onClick={() => goToStep(currentStep + 1)}
          className="gap-1.5 text-white/60"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Complete state */}
      {currentStep === total - 1 && (
        <div className="px-4 pb-6">
          <Button
            onClick={onClose}
            className="w-full gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-pink-600 py-6 text-base font-bold"
          >
            <ChefHat className="h-5 w-5" /> Dish Complete! 🎉
          </Button>
        </div>
      )}
    </div>
  )
}
