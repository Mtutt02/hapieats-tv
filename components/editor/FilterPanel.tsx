'use client'

import { useState, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterSettings, DEFAULT_FILTERS } from './types'

interface FilterPanelProps {
  filters: FilterSettings
  onFiltersChange: (filters: FilterSettings) => void
  videoUrl: string
}

const PRESETS: { id: string; label: string; preview: string; values: Partial<FilterSettings> }[] = [
  { id: 'none', label: 'Normal', preview: 'bg-gradient-to-br from-zinc-700 to-zinc-600', values: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, blur: 0, preset: null } },
  { id: 'vintage', label: 'Vintage', preview: 'bg-gradient-to-br from-amber-300 to-yellow-600', values: { brightness: 10, contrast: -10, saturation: -20, warmth: 30, blur: 0, preset: 'vintage' } },
  { id: 'noir', label: 'Noir', preview: 'bg-gradient-to-br from-zinc-900 to-zinc-700', values: { brightness: -10, contrast: 30, saturation: -100, warmth: 0, blur: 0, preset: 'noir' } },
  { id: 'cinematic', label: 'Cinematic', preview: 'bg-gradient-to-br from-teal-700 to-orange-800', values: { brightness: -5, contrast: 20, saturation: -30, warmth: 15, blur: 0, preset: 'cinematic' } },
  { id: 'warm', label: 'Warm', preview: 'bg-gradient-to-br from-orange-400 to-red-500', values: { brightness: 5, contrast: 0, saturation: 20, warmth: 40, blur: 0, preset: 'warm' } },
  { id: 'cool', label: 'Cool', preview: 'bg-gradient-to-br from-blue-400 to-cyan-600', values: { brightness: -5, contrast: 0, saturation: -10, warmth: -40, blur: 0, preset: 'cool' } },
  { id: 'dramatic', label: 'Dramatic', preview: 'bg-gradient-to-br from-zinc-900 to-blue-900', values: { brightness: -15, contrast: 50, saturation: 30, warmth: -10, blur: 0, preset: 'dramatic' } },
]

export default function FilterPanel({ filters, onFiltersChange, videoUrl }: FilterPanelProps) {
  const [sliderValues, setSliderValues] = useState({
    brightness: filters.brightness,
    contrast: filters.contrast,
    saturation: filters.saturation,
    warmth: filters.warmth,
    blur: filters.blur,
  })

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    const newFilters: FilterSettings = {
      ...filters,
      ...preset.values,
      preset: preset.id === 'none' ? null : preset.id,
    }
    onFiltersChange(newFilters)
    setSliderValues({
      brightness: newFilters.brightness,
      contrast: newFilters.contrast,
      saturation: newFilters.saturation,
      warmth: newFilters.warmth,
      blur: newFilters.blur,
    })
  }

  const handleSliderChange = (key: keyof typeof sliderValues, value: number) => {
    setSliderValues(prev => ({ ...prev, [key]: value }))
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  const handleReset = () => {
    handlePresetSelect(PRESETS[0])
  }

  return (
    <div className="space-y-5">
      {/* Preset filter cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Preset Filters</h3>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(preset => {
            const isActive = filters.preset === preset.id || (preset.id === 'none' && !filters.preset)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
                  isActive
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50'
                )}
              >
                <div
                  className={cn(
                    'w-full aspect-video rounded-lg flex items-center justify-center',
                    preset.preview
                  )}
                >
                  {isActive && <Check className="h-5 w-5 text-white drop-shadow-lg" />}
                </div>
                <span className={cn(
                  'text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-zinc-400'
                )}>
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual slider adjustments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fine Tune</h3>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            Reset all
          </button>
        </div>

        {([
          { key: 'brightness' as const, label: 'Brightness', min: -100, max: 100 },
          { key: 'contrast' as const, label: 'Contrast', min: -100, max: 100 },
          { key: 'saturation' as const, label: 'Saturation', min: -100, max: 100 },
          { key: 'warmth' as const, label: 'Warmth', min: -100, max: 100 },
          { key: 'blur' as const, label: 'Blur', min: 0, max: 20 },
        ]).map(({ key, label, min, max }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              value={sliderValues[key]}
              onChange={e => handleSliderChange(key, Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-xs text-zinc-500 w-8 text-right font-mono">{sliderValues[key]}</span>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50 text-xs text-zinc-500">
        Filters render in real-time on the video preview. The video will be exported with these filter settings applied.
      </div>
    </div>
  )
}
