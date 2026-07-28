'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  className?: string
  initialValue?: string
}

export default function SearchBar({
  placeholder = 'Search...',
  className,
  initialValue = '',
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setValue('')
      inputRef.current?.blur()
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative flex items-center w-full', className)}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 text-sm rounded-full border border-border bg-muted/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
      />
    </form>
  )
}
