"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Upload, Play, Pause, Download, Scissors, Music, Type, Sparkles,
  Film, Settings, Trash2, Plus, Mic, Volume2, Square, Star,
} from "lucide-react";
import { TEMPLATES, type TemplateId } from "../../remotion/templates";
import {
  createVoiceoverRecorder, BUILTIN_TRACKS, duckedVolume,
  formatDuration, analyzeAudio,
  type AudioSource, type RecordingState,
} from "./audio-utils";
import "./editor.css";

type Clip = {
  id: number;
  name: string;
  url: string;
  start: number;
  end: number;
  duration: number;
  caption: string;
};

type TemplateData = Record<string, string | number | string[]>;

export default function HapieatsTVEditor() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("HapieatsTV");
  const [currentTime, setCurrentTime] = useState(0);

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("blank");
  const [templateFields, setTemplateFields] = useState<TemplateData>({});

  // Audio
  const [musicTrack, setMusicTrack] = useState<AudioSource | null>(null);
  const [voiceover, setVoiceover] = useState<AudioSource | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [voiceoverVolume, setVoiceoverVolume] = useState(1);
  const [duckEnabled, setDuckEnabled] = useState(true);
  const [showBuiltinLibrary, setShowBuiltinLibrary] = useState(false);
  const [recorderState, setRecorderState] = useState<RecordingState>("idle");
  const [recDuration, setRecDuration] = useState(0);
  const recorderRef = useRef<ReturnType<typeof createVoiceoverRecorder> | null>(null);

  // ── Clips ──
  const uploadClips = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newClips: Clip[] = files.map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      url: URL.createObjectURL(file),
      start: 0,
      end: 15,
      duration: 0,
      caption: "",
    }));
    setClips((prev) => [...prev, ...newClips]);
    if (!activeClip && newClips[0]) setActiveClip(newClips[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clips.forEach((clip) => {
      if (clip.duration === 0) {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => {
          const dur = vid.duration;
          setClips((prev) =>
            prev.map((c) => c.id === clip.id ? { ...c, duration: dur, end: Math.min(c.end, dur) } : c)
          );
        };
        vid.src = clip.url;
      }
    });
  }, [clips]);

  const updateClip = useCallback((id: number, updates: Partial<Clip>) => {
    setClips((prev) => prev.map((clip) => clip.id === id ? { ...clip, ...updates } : clip));
    if (activeClip?.id === id) setActiveClip((prev) => prev && { ...prev, ...updates });
  }, [activeClip]);

  const deleteClip = useCallback((id: number) => {
    setClips((prev) => {
      const filtered = prev.filter((clip) => clip.id !== id);
      if (activeClip?.id === id) setActiveClip(filtered[0] || null);
      return filtered;
    });
  }, [activeClip]);

  // ── Template ──
  const template = TEMPLATES[selectedTemplate];

  const changeTemplate = useCallback((tid: TemplateId) => {
    setSelectedTemplate(tid);
    setTemplateFields({});
    setRenderUrl(null);
  }, []);

  const updateTemplateField = useCallback((key: string, value: string | number | string[]) => {
    setTemplateFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Playback ──
  const togglePlay = useCallback(() => {
    if (!videoRef.current || !activeClip) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.currentTime = activeClip.start; videoRef.current.play(); setIsPlaying(true); }
  }, [activeClip, isPlaying]);

  // ── Audio ──
  const uploadBackgroundMusic = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const info = await analyzeAudio(url);
    setMusicTrack({ id: Date.now(), name: file.name, url, type: "music", volume: musicVolume, startAt: 0, fadeIn: 1, fadeOut: 2, duration: info.duration, waveform: info.waveform });
  }, [musicVolume]);

  const addBuiltinTrack = useCallback(async (track: { name: string; url: string }) => {
    const info = await analyzeAudio(track.url);
    setMusicTrack({ id: Date.now(), name: track.name, url: track.url, type: "music", volume: musicVolume, startAt: 0, fadeIn: 1, fadeOut: 2, duration: info.duration, waveform: info.waveform });
    setShowBuiltinLibrary(false);
  }, [musicVolume]);

  // ── Voiceover ──
  const startVoiceover = useCallback(async () => {
    try {
      const r = createVoiceoverRecorder((state) => setRecorderState(state));
      recorderRef.current = r;
      await r.start();
    } catch { alert("Microphone access denied."); }
  }, []);

  const stopVoiceover = useCallback(async () => {
    if (!recorderRef.current) return;
    const blob = await recorderRef.current.stop();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const info = await analyzeAudio(url);
    setVoiceover({ id: Date.now(), name: `Voiceover ${formatDuration(recDuration)}`, url, type: "voiceover", volume: voiceoverVolume, startAt: 0, fadeIn: 0.3, fadeOut: 1, duration: info.duration, waveform: info.waveform });
    setRecDuration(0);
    setRecorderState("idle");
  }, [recDuration, voiceoverVolume]);

  const uploadVoiceover = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const info = await analyzeAudio(url);
    setVoiceover({ id: Date.now(), name: file.name, url, type: "voiceover", volume: voiceoverVolume, startAt: 0, fadeIn: 0.3, fadeOut: 1, duration: info.duration, waveform: info.waveform });
  }, [voiceoverVolume]);

  // ── Render ──
  const exportProject = useCallback(async () => {
    if (clips.length === 0) return;
    setRendering(true);
    setRenderUrl(null);

    const inputProps = {
      title: projectTitle,
      template: selectedTemplate,
      clips: clips.map((clip) => ({
        src: clip.url,
        caption: clip.caption || undefined,
        durationInFrames: Math.max(1, (clip.end - clip.start) * 30),
        startAt: clip.start,
      })),
      backgroundMusic: musicTrack ? {
        src: musicTrack.url,
        volume: duckEnabled && voiceover ? duckedVolume(musicTrack.volume, true) : musicTrack.volume,
        startAt: musicTrack.startAt, fadeIn: musicTrack.fadeIn, fadeOut: musicTrack.fadeOut,
      } : null,
      voiceover: voiceover ? {
        src: voiceover.url, volume: voiceover.volume,
        startAt: voiceover.startAt, fadeIn: voiceover.fadeIn, fadeOut: voiceover.fadeOut,
      } : null,
      templateFields,
    };

    try {
      const res = await fetch("/api/studio/render", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputProps),
      });
      const data = await res.json();
      if (data.success) setRenderUrl(data.videoUrl);
      else alert(`Render failed: ${data.error}`);
    } catch {
      alert("Render engine connecting soon.");
    }
    setRendering(false);
  }, [clips, projectTitle, selectedTemplate, musicTrack, voiceover, duckEnabled, templateFields]);

  // ── Recorder timer ──
  useEffect(() => {
    if (recorderState === "recording" && recorderRef.current) {
      const interval = setInterval(() => { setRecDuration(recorderRef.current?.duration || 0); }, 100);
      return () => clearInterval(interval);
    }
  }, [recorderState]);

  const clipEnd = activeClip ? Math.min(activeClip.end, activeClip.duration || Infinity) : 0;
  const totalVideoDuration = clips.reduce((sum, c) => sum + (c.end - c.start), 0);

  return (
    <main className="htv-app">
      <aside className="htv-sidebar">
        <div className="htv-logo">
          <div className="htv-logo-mark">H</div>
        </div>
        <button className="htv-nav active"><Film size={20} />Media</button>
        <button className="htv-nav"><Type size={20} />Text</button>
        <button className="htv-nav"><Music size={20} />Audio</button>
        <button className="htv-nav"><Sparkles size={20} />Effects</button>
        <button className="htv-nav bottom"><Settings size={20} />Settings</button>
      </aside>

      <section className="htv-media-panel">
        <h2>Media Library</h2>
        <label className="htv-upload">
          <Upload size={20} /> Upload Food Clips
          <input type="file" accept="video/*" multiple onChange={uploadClips} />
        </label>

        <div className="htv-section-title">Templates</div>
        <div className="htv-template-strip">
          {Object.values(TEMPLATES).map((t) => (
            <button key={t.id} onClick={() => changeTemplate(t.id)}
              className={`htv-template-btn ${selectedTemplate === t.id ? "active" : ""}`}>
              <span className="htv-template-icon">{t.icon}</span>
              <span className="htv-template-label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="htv-section-title">Project Clips</div>
        <div className="htv-clip-list">
          {clips.length === 0 && <p className="htv-empty">Upload cooking, review, or food clips.</p>}
          {clips.map((clip) => (
            <button key={clip.id} onClick={() => setActiveClip(clip)}
              className={`htv-clip-card ${activeClip?.id === clip.id ? "selected" : ""}`}>
              <div className="htv-thumb">▶</div>
              <div><strong>{clip.name}</strong><span>{clip.start}s - {clip.end?.toFixed(1)}s</span></div>
            </button>
          ))}
        </div>
      </section>

      <section className="htv-main">
        <header className="htv-topbar">
          <div>
            <h2><input className="htv-title-input" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} /></h2>
            <p>{template.label} — {clips.length} clip{clips.length !== 1 ? "s" : ""}, {formatDuration(totalVideoDuration)} total</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {renderUrl && (
              <a href={renderUrl} download className="htv-export" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                <Download size={18} /> Download MP4
              </a>
            )}
            <button onClick={exportProject} disabled={rendering || clips.length === 0} className="htv-export">
              <Download size={18} /> {rendering ? "Rendering…" : "Export"}
            </button>
          </div>
        </header>

        <div className="htv-preview-wrap">
          <div className="htv-preview">
            {activeClip ? (
              <>
                <video ref={videoRef} src={activeClip.url} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} />
                {activeClip.caption && <div className="htv-caption">{activeClip.caption}</div>}
                {(musicTrack || voiceover) && (
                  <div className="htv-audio-badge"><Volume2 size={14} />{musicTrack && <span>Music</span>}{voiceover && <span>Voice</span>}</div>
                )}
              </>
            ) : (
              <div className="htv-placeholder"><h3>Ready to cook up a video?</h3><p>Pick a template or upload clips to start.</p></div>
            )}
          </div>
          <div className="htv-controls">
            <button onClick={togglePlay}>{isPlaying ? <Pause size={22} /> : <Play size={22} />}</button>
            <span>{activeClip ? `${currentTime.toFixed(1)}s / ${clipEnd.toFixed(1)}s` : "0s"}</span>
          </div>
        </div>

        <div className="htv-timeline">
          <div className="htv-timeline-toolbar">
            <button><Scissors size={18} /> Split</button>
            <button><Plus size={18} /> Add Track</button>
          </div>

          <div className="htv-track-label">Video Track</div>
          <div className="htv-track">
            {clips.length === 0 && <div className="htv-empty-track">Drop video clips here</div>}
            {clips.map((clip) => (
              <div key={clip.id} onClick={() => setActiveClip(clip)} className={`htv-timeline-clip ${activeClip?.id === clip.id ? "active" : ""}`}>
                <span>{clip.name}</span><small>{clip.start}s - {clip.end?.toFixed(1)}s</small>
              </div>
            ))}
          </div>

          <div className="htv-track-label"><Music size={14} /> Music Track</div>
          <div className="htv-audio-track-render">
            {musicTrack ? (
              <div className="htv-audio-clip">
                <div className="htv-audio-clip-info"><strong>{musicTrack.name}</strong><span>{formatDuration(musicTrack.duration)}</span></div>
                <div className="htv-audio-waveform">{musicTrack.waveform?.map((amp, i) => <div key={i} className="htv-wave-bar" style={{ height: `${amp * 32}px` }} />)}</div>
                <div className="htv-audio-controls">
                  <Volume2 size={16} />
                  <input type="range" min={0} max={1} step={0.05} value={musicVolume}
                    onChange={(e) => { const v = Number(e.target.value); setMusicVolume(v); if (musicTrack) setMusicTrack({ ...musicTrack, volume: v }); }}
                    className="htv-volume-slider" />
                  <button className="htv-remove-audio" onClick={() => setMusicTrack(null)}><Trash2 size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="htv-audio-empty">
                <Music size={18} /><span>Add background music</span>
                <label className="htv-small-upload">Upload<input type="file" accept="audio/*" onChange={uploadBackgroundMusic} /></label>
                <button className="htv-small-btn" onClick={() => setShowBuiltinLibrary(!showBuiltinLibrary)}>Library</button>
              </div>
            )}
            {showBuiltinLibrary && !musicTrack && (
              <div className="htv-builtin-library">
                {BUILTIN_TRACKS.map((track) => (
                  <button key={track.id} className="htv-builtin-track" onClick={() => addBuiltinTrack(track)}>
                    <span className="htv-builtin-name">{track.name}</span>
                    <span className="htv-builtin-meta">{track.mood} · {track.bpm} BPM</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="htv-track-label"><Mic size={14} /> Voiceover</div>
          <div className="htv-audio-track-render">
            {voiceover ? (
              <div className="htv-audio-clip">
                <div className="htv-audio-clip-info"><strong>{voiceover.name}</strong><span>{formatDuration(voiceover.duration)}</span></div>
                <div className="htv-audio-waveform">{voiceover.waveform?.map((amp, i) => <div key={i} className="htv-wave-bar vo-bar" style={{ height: `${amp * 32}px` }} />)}</div>
                <div className="htv-audio-controls">
                  <Volume2 size={16} />
                  <input type="range" min={0} max={1} step={0.05} value={voiceoverVolume}
                    onChange={(e) => { const v = Number(e.target.value); setVoiceoverVolume(v); if (voiceover) setVoiceover({ ...voiceover, volume: v }); }}
                    className="htv-volume-slider" />
                  <button className="htv-remove-audio" onClick={() => setVoiceover(null)}><Trash2 size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="htv-audio-empty">
                <Mic size={18} /><span>Record or upload voiceover</span>
                {recorderState === "idle" && <>
                  <button className="htv-small-btn rec-btn" onClick={startVoiceover}><Mic size={14} /> Record</button>
                  <label className="htv-small-upload">Upload<input type="file" accept="audio/*" onChange={uploadVoiceover} /></label>
                </>}
                {recorderState === "recording" && (
                  <div className="htv-recording-indicator">
                    <span className="htv-rec-pulse" /> Recording {formatDuration(recDuration)}
                    <button className="htv-small-btn stop-btn" onClick={stopVoiceover}><Square size={12} /> Stop</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {musicTrack && voiceover && (
            <div className="htv-ducking-toggle">
              <label><input type="checkbox" checked={duckEnabled} onChange={(e) => setDuckEnabled(e.target.checked)} /> Auto-duck music during voiceover</label>
            </div>
          )}
        </div>
      </section>

      <aside className="htv-inspector">
        <h2>Inspector</h2>
        {template.fields.length > 0 && (
          <>
            <div className="htv-section-title">{template.label} Settings</div>
            {template.fields.map((field) => (
              <div key={field.key}>
                <label>{field.label}</label>
                {field.type === "textarea" || field.type === "list" ? (
                  <textarea placeholder={field.placeholder} value={String(templateFields[field.key] || "")}
                    onChange={(e) => updateTemplateField(field.key, field.type === "list" ? e.target.value.split("\n") : e.target.value)} rows={6} />
                ) : field.type === "stars" ? (
                  <div className="htv-star-selector">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => updateTemplateField(field.key, n)}
                        className={`htv-star-btn ${(Number(templateFields[field.key]) || 0) >= n ? "active" : ""}`}>
                        <Star size={22} fill={(Number(templateFields[field.key]) || 0) >= n ? "#FFD166" : "none"} color="#FFD166" />
                      </button>
                    ))}
                    <span className="htv-star-value">{String(templateFields[field.key] !== undefined ? templateFields[field.key] : "—")}/5</span>
                  </div>
                ) : (
                  <input type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder}
                    value={String(templateFields[field.key] || "")}
                    onChange={(e) => updateTemplateField(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)} />
                )}
              </div>
            ))}
          </>
        )}

        {template.fields.length > 0 && <div className="htv-inspector-divider" />}

        {activeClip ? (
          <>
            <div className="htv-section-title">Clip Settings</div>
            <label>Clip Name</label>
            <input value={activeClip.name} onChange={(e) => updateClip(activeClip.id, { name: e.target.value })} />
            <label>Start Time (s)</label>
            <input type="number" min={0} step={0.1} value={activeClip.start} onChange={(e) => updateClip(activeClip.id, { start: Number(e.target.value) })} />
            <label>End Time (s)</label>
            <input type="number" min={activeClip.start + 0.1} step={0.1} value={activeClip.end} onChange={(e) => updateClip(activeClip.id, { end: Number(e.target.value) })} />
            <label>Caption / Recipe Text</label>
            <textarea placeholder="e.g. Garlic butter hibachi shrimp..." value={activeClip.caption} onChange={(e) => updateClip(activeClip.id, { caption: e.target.value })} />
            <button className="htv-delete" onClick={() => deleteClip(activeClip.id)}><Trash2 size={18} /> Delete Clip</button>
          </>
        ) : (
          <p className="htv-empty">Select a clip to edit.</p>
        )}
      </aside>
    </main>
  );
}
