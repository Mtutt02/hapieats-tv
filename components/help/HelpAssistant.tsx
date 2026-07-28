'use client'

// ============================================================
// Hapi Helper — floating in-app assistant. Ask how anything on
// HapiEats TV works; answers come from /api/help/chat (Claude).
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircleQuestion, X, Send, Loader2, Sparkles } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'How do I upload a video?',
  'What are Hapi Tokens?',
  'How do Clips work?',
  'What is HapiEats Pro?',
]

const HIDDEN = [/^\/studio\/editor/, /^\/live\/[^/]+/, /^\/clips/]

export default function HelpAssistant() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: "Hi! I'm Hapi Helper 🍽️ — ask me anything about how HapiEats TV works." },
  ])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])

  // Let any button anywhere open the assistant via window.dispatchEvent(new Event('open-hapi-helper'))
  useEffect(() => {
    const openit = () => setOpen(true)
    window.addEventListener('open-hapi-helper', openit)
    return () => window.removeEventListener('open-hapi-helper', openit)
  }, [])

  if (HIDDEN.some(re => re.test(pathname))) return null

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const next = [...msgs, { role: 'user' as const, content: q }]
    setMsgs(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter(m => m.role !== 'assistant' || m.content.length < 1900) }),
      })
      const data = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: data.reply || data.error || "I'm not sure — try /faq." }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: "I couldn't reach the assistant. Try again in a moment." }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-5 right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-5 right-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" style={{ height: 'min(70vh, 560px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm">🍽️</span>
              <div>
                <p className="text-sm font-bold leading-none">Hapi Helper</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">How can I help?</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={[
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
                ].join(' ')}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted px-3 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
              </div>
            )}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex items-center gap-2 border-t border-border p-2.5">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about HapiEats TV…"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button type="submit" disabled={busy || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="px-3 pb-2 text-center text-[9px] text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> AI assistant — may be imperfect. For accounts &amp; billing, see /contact.
          </p>
        </div>
      )}
    </>
  )
}
