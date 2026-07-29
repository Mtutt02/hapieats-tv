'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { type FlavorProfileData } from '@/components/profile/ProfileHero'
import { Dna, Wheat, ChefHat, Thermometer } from 'lucide-react'

interface FlavorProfileCardProps {
  flavorProfile: FlavorProfileData | null | undefined
  displayName: string
}

function MeterBar({ value, max = 5, color, icon: Icon, label }: {
  value: number; max?: number; color: string; icon: React.ElementType; label: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="text-xs font-medium text-foreground/70">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default function FlavorProfileCard({ flavorProfile, displayName }: FlavorProfileCardProps) {
  if (!flavorProfile) {
    return (
      <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Dna className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-lg">HapiEats DNA</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {displayName} hasn&apos;t completed their taste profile yet.
        </p>
      </div>
    )
  }

  const { cuisines, dietary_tags, heat_level, comfort_level, skill_level, signature_ingredients, preferred_methods } = flavorProfile

  return (
    <div className="rounded-3xl border border-foreground/5 bg-card/50 backdrop-blur-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-lg">HapiEats DNA</h3>
        <span className="text-xs text-muted-foreground ml-auto">Taste Identity</span>
      </div>

      {/* Meters */}
      <div className="space-y-3">
        <MeterBar value={heat_level ?? 1} color="bg-gradient-to-r from-amber-400 to-red-500" icon={Thermometer} label="Heat" />
        <MeterBar value={comfort_level ?? 1} color="bg-gradient-to-r from-emerald-400 to-teal-500" icon={Wheat} label="Comfort" />
        <MeterBar value={skill_level ?? 1} color="bg-gradient-to-r from-violet-400 to-cyan-500" icon={ChefHat} label="Skill" />
      </div>

      {/* Cuisines */}
      {cuisines && cuisines.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Cuisines</p>
          <div className="flex flex-wrap gap-1.5">
            {cuisines.map((c) => (
              <span key={c} className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-medium">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Tags */}
      {dietary_tags && dietary_tags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Dietary</p>
          <div className="flex flex-wrap gap-1.5">
            {dietary_tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-400 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Signature Ingredients */}
      {signature_ingredients && signature_ingredients.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Signature Ingredients</p>
          <div className="flex flex-wrap gap-1.5">
            {signature_ingredients.map((ing) => (
              <span key={ing} className="px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-xs font-medium">
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Methods */}
      {preferred_methods && preferred_methods.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Methods</p>
          <div className="flex flex-wrap gap-1.5">
            {preferred_methods.map((m) => (
              <span key={m} className="px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-xs font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
