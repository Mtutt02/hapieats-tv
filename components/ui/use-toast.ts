import { useState, useEffect, useCallback } from 'react'

type ToastVariant = 'default' | 'destructive'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: React.ReactNode
}

let count = 0
const genId = () => String(++count)

const listeners: Array<(toasts: Toast[]) => void> = []
let memoryToasts: Toast[] = []

function dispatch(toast: Toast) {
  memoryToasts = [...memoryToasts, toast]
  listeners.forEach((l) => l(memoryToasts))
  if (toast.duration !== Infinity) {
    setTimeout(() => {
      memoryToasts = memoryToasts.filter((t) => t.id !== toast.id)
      listeners.forEach((l) => l(memoryToasts))
    }, toast.duration ?? 4000)
  }
}

export function toast(props: Omit<Toast, 'id'>) {
  dispatch({ id: genId(), ...props })
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryToasts)
  useEffect(() => {
    listeners.push(setToasts)
    return () => { const idx = listeners.indexOf(setToasts); if (idx > -1) listeners.splice(idx, 1) }
  }, [])
  return { toasts, toast }
}
