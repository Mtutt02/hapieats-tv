import { Eye, DollarSign, Users, Film } from 'lucide-react'
import { formatViews, formatCurrency } from '@/lib/utils'
import type { CreatorStats } from '@/types'

interface Props {
  stats: CreatorStats
}

const statCards = (stats: CreatorStats) => [
  {
    label: 'Total Views',
    value: formatViews(stats.total_views),
    icon: Eye,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    label: 'Total Revenue',
    value: formatCurrency(stats.total_revenue),
    icon: DollarSign,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  {
    label: 'Subscribers',
    value: stats.subscriber_count.toLocaleString(),
    icon: Users,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    label: 'Videos',
    value: stats.video_count.toString(),
    icon: Film,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
]

export default function DashboardStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards(stats).map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="rounded-2xl border bg-card p-5">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${card.bg} mb-3`}>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{card.label}</p>
          </div>
        )
      })}
    </div>
  )
}
