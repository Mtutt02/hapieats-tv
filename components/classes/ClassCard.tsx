import Link from 'next/link'
import Image from 'next/image'
import { Users, Clock, Lock } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatViews } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Class } from '@/types'

const categoryGradients: Record<string, string> = {
  baking: 'from-orange-400 to-amber-600',
  cooking: 'from-red-400 to-rose-600',
  pastry: 'from-pink-400 to-purple-500',
  grilling: 'from-orange-600 to-red-700',
  international: 'from-blue-400 to-indigo-600',
  vegan: 'from-green-400 to-emerald-600',
  nutrition: 'from-teal-400 to-cyan-600',
  general: 'from-gray-400 to-gray-600',
}

const typeBadge: Record<string, { label: string; className: string }> = {
  live: { label: 'LIVE', className: 'bg-red-500 text-white' },
  series: { label: 'Series', className: 'bg-purple-500 text-white' },
  recorded: { label: 'Recorded', className: 'bg-blue-500 text-white' },
}

const skillBadge: Record<string, { label: string; className: string }> = {
  beginner: { label: 'Beginner', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  intermediate: { label: 'Intermediate', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  advanced: { label: 'Advanced', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  all_levels: { label: 'All Levels', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
}

interface ClassCardProps {
  class: Class
}

export default function ClassCard({ class: cls }: ClassCardProps) {
  const gradient = categoryGradients[cls.category] ?? categoryGradients.general
  const type = typeBadge[cls.type]
  const skill = skillBadge[cls.skill_level] ?? skillBadge.all_levels
  const instructorName = cls.instructor?.display_name ?? cls.instructor?.username ?? 'Instructor'
  const instructorInitial = instructorName.charAt(0).toUpperCase()

  const isLiveUpcoming =
    cls.type === 'live' &&
    cls.scheduled_at &&
    new Date(cls.scheduled_at) > new Date()

  return (
    <Link href={`/classes/${cls.id}`} className="group flex flex-col rounded-xl overflow-hidden border bg-card hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {cls.thumbnail_url ? (
          <Image
            src={cls.thumbnail_url}
            alt={cls.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
        )}

        {/* Type badge overlay */}
        {type && (
          <span className={cn('absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded', type.className)}>
            {type.label}
          </span>
        )}

        {/* Skill level badge */}
        <span className={cn('absolute bottom-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full', skill.className)}>
          {skill.label}
        </span>

        {/* Upcoming live time */}
        {isLiveUpcoming && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {new Date(cls.scheduled_at!).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {/* Category */}
        <span className="text-xs text-muted-foreground capitalize">{cls.category}</span>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {cls.title}
        </h3>

        {/* Instructor */}
        <div className="flex items-center gap-1.5 mt-auto">
          <Avatar className="h-5 w-5">
            <AvatarImage src={cls.instructor?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs bg-primary text-white">{instructorInitial}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{instructorName}</span>
        </div>

        {/* Price + enrollment */}
        <div className="flex items-center justify-between mt-1">
          <span className="font-semibold text-sm">
            {cls.price === 0 ? (
              <span className="text-green-600 dark:text-green-400">Free</span>
            ) : (
              formatCurrency(cls.price)
            )}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{formatViews(cls.enrollment_count)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
