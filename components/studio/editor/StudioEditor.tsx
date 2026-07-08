'use client'

// ============================================================
// HapiEats TV Studio — Editor Shell
// Full-screen branded editor: tool dock · preview · inspector
// · multi-track timeline. Autosaves locally + cloud sync.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Undo2, Redo2, Save, UploadCloud, Loader2, FolderOpen,
  Crown, MonitorSmartphone, X, Trash2, PanelRightClose, PanelRightOpen,
} from 'lucide-react'
import { useEditor } from '@/lib/editor/store'
import { AspectPreset, EditorProject } from '@/lib/editor/types'
import {
  saveProjectLocal, listProjectsLocal, loadProjectLocal, deleteProjectLocal, syncProjectToCloud,
} from '@/lib/editor/persist'
import { PremiumProvider, usePremium } from './usePremium'
import PreviewPanel from './PreviewPanel'
import TimelinePanel from './TimelinePanel'
import InspectorPanel from './InspectorPanel'
import ToolDock from './ToolDock'
import ExportDialog from './ExportDialog'

const HDR_BTN = 'inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent'

function ProBadge() {
  const { isPremium, loading, gate } = usePremium()
  if (loading) return null
  return isPremium ? (
    <span className="hidden items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 sm:flex">
      <Crown className="h-3 w-3" /> PRO
    </span>
  ) : (
    <button
      onClick={() => gate('Studio Pro')}
      className="hidden items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-0.5 text-[10px] font-bold text-black hover:opacity-90 sm:flex"
    >
      <Crown className="h-3 w-3" /> Upgrade
    </button>
  )
}

function EditorShell() {
  const project = useEditor(s => s.project)
  const dirty = useEditor(s => s.dirty)
  const past = useEditor(s => s.past)
  const future = useEditor(s => s.future)
  const { setTitle, setAspect, undo, redo, markSaved, loadProject, reset, splitClip, removeClip } = useEditor()
  const [showExport, setShowExport] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showInspector, setShowInspector] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedProjects, setSavedProjects] = useState<EditorProject[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- autosave (local, debounced) ----
  useEffect(() => {
    if (!dirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveProjectLocal(useEditor.getState().project).catch(() => {})
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [dirty, project.updatedAt])

  const manualSave = useCallback(async () => {
    setSaving(true)
    const p = useEditor.getState().project
    await saveProjectLocal(p).catch(() => {})
    await syncProjectToCloud(p)
    markSaved()
    setSaving(false)
  }, [markSaved])

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const s = useEditor.getState()
      if (e.code === 'Space') { e.preventDefault(); useEditor.setState({ playing: !s.playing }) }
      else if (e.key === 's' && !e.ctrlKey && !e.metaKey) { if (s.selectedClipId) splitClip(s.selectedClipId, s.currentTime) }
      else if ((e.key === 'Delete' || e.key === 'Backspace')) { if (s.selectedClipId) removeClip(s.selectedClipId) }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); manualSave() }
      else if (e.key === 'ArrowLeft') { useEditor.setState({ playing: false }); s.setTime(s.currentTime - (e.shiftKey ? 1 : 1 / 30)) }
      else if (e.key === 'ArrowRight') { useEditor.setState({ playing: false }); s.setTime(s.currentTime + (e.shiftKey ? 1 : 1 / 30)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, splitClip, removeClip, manualSave])

  // ---- projects modal ----
  const openProjects = async () => {
    setSavedProjects(await listProjectsLocal())
    setShowProjects(true)
  }

  const openProject = async (id: string) => {
    const p = await loadProjectLocal(id)
    if (p) loadProject(p)
    setShowProjects(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      {/* ---- top bar ---- */}
      <header className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2">
        <Link href="/studio" className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Back to Studio">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="hidden bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-sm font-black tracking-tight text-transparent sm:block">
            HapiEats TV Studio
          </span>
          <ProBadge />
        </div>
        <input
          value={project.title}
          onChange={e => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-zinc-800 focus:border-emerald-500 sm:mx-4 sm:max-w-xs"
          aria-label="Project title"
        />
        <select
          value={project.aspect}
          onChange={e => setAspect(e.target.value as AspectPreset)}
          className="hidden rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300 sm:block"
          title="Aspect ratio"
        >
          <option value="16:9">16:9 · Landscape</option>
          <option value="9:16">9:16 · Vertical</option>
          <option value="1:1">1:1 · Square</option>
        </select>
        <button onClick={undo} disabled={past.length === 0} className={HDR_BTN} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
        <button onClick={redo} disabled={future.length === 0} className={HDR_BTN} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></button>
        <button onClick={openProjects} className={HDR_BTN} title="My projects"><FolderOpen className="h-4 w-4" /></button>
        <button onClick={manualSave} className={HDR_BTN} title="Save (Ctrl+S)">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className={`h-4 w-4 ${dirty ? 'text-amber-400' : ''}`} />}
        </button>
        <button onClick={() => setShowInspector(v => !v)} className={`${HDR_BTN} hidden lg:flex`} title="Toggle inspector">
          {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-bold text-black hover:opacity-90 sm:px-4"
        >
          <UploadCloud className="h-4 w-4" /> Export
        </button>
      </header>

      {/* ---- main area ---- */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* tool dock — left on desktop, below preview on mobile */}
        <aside className="order-2 h-56 shrink-0 border-t border-zinc-800/80 lg:order-1 lg:h-auto lg:w-72 lg:border-t-0 lg:border-r">
          <ToolDock />
        </aside>

        {/* preview */}
        <main className="order-1 min-h-0 flex-1 p-2 lg:order-2 lg:p-3" style={{ minHeight: '34vh' }}>
          <PreviewPanel />
        </main>

        {/* inspector */}
        {showInspector && (
          <aside className="order-3 hidden w-72 shrink-0 border-l border-zinc-800/80 lg:block">
            <InspectorPanel />
          </aside>
        )}
      </div>

      {/* mobile inspector (bottom sheet style) */}
      <div className="lg:hidden">
        <MobileInspector />
      </div>

      {/* ---- timeline ---- */}
      <div className="h-52 shrink-0 p-2 pt-0 sm:h-60">
        <TimelinePanel />
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {showProjects && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowProjects(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">My projects</h3>
              <button onClick={() => setShowProjects(false)} className="text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <button
              onClick={() => { reset(); setShowProjects(false) }}
              className="mt-3 w-full rounded-xl border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-300 hover:border-emerald-500/60"
            >
              + New project
            </button>
            <div className="mt-2 space-y-1.5">
              {savedProjects.length === 0 && <p className="py-4 text-center text-xs text-zinc-600">No saved projects yet — edits autosave as you work.</p>}
              {savedProjects.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                  <button onClick={() => openProject(p.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(p.updatedAt).toLocaleString()} · {p.aspect}</p>
                  </button>
                  <button
                    onClick={async () => { await deleteProjectLocal(p.id); setSavedProjects(await listProjectsLocal()) }}
                    className="text-zinc-600 hover:text-red-400"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-600">
              <MonitorSmartphone className="h-3 w-3" /> Projects save on this device and sync to your account when you hit Save.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

/** Compact inspector for small screens — shows when a clip is selected. */
function MobileInspector() {
  const selectedClipId = useEditor(s => s.selectedClipId)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (selectedClipId) setOpen(true) }, [selectedClipId])
  if (!selectedClipId || !open) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[55vh] overflow-hidden rounded-t-2xl border-t border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-bold text-zinc-300">Clip settings</span>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="h-[45vh]">
        <InspectorPanel />
      </div>
    </div>
  )
}

export default function StudioEditor() {
  return (
    <PremiumProvider>
      <EditorShell />
    </PremiumProvider>
  )
}
