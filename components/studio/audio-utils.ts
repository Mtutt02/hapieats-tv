export type AudioSource = {
  id: number;
  name: string;
  url: string;
  type: "music" | "voiceover";
  volume: number;
  startAt: number;
  fadeIn: number;
  fadeOut: number;
  duration: number;
  waveform?: number[];
};

export type RecordingState = "idle" | "recording" | "paused" | "done";

export type VoiceoverRecorder = {
  state: RecordingState;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob | null>;
  duration: number;
  onStateChange: (state: RecordingState) => void;
};

export const BUILTIN_TRACKS = [
  { id: "chill-lo-fi", name: "Chill Lo-Fi", genre: "Lo-Fi", mood: "Relaxed", bpm: 85, url: "https://cdn.hapieatstv.com/audio/chill-lo-fi.mp3" },
  { id: "upbeat-funk", name: "Upbeat Funk", genre: "Funk", mood: "Energetic", bpm: 110, url: "https://cdn.hapieatstv.com/audio/upbeat-funk.mp3" },
  { id: "smooth-jazz", name: "Smooth Jazz", genre: "Jazz", mood: "Classy", bpm: 90, url: "https://cdn.hapieatstv.com/audio/smooth-jazz.mp3" },
  { id: "acoustic-vibes", name: "Acoustic Vibes", genre: "Acoustic", mood: "Warm", bpm: 80, url: "https://cdn.hapieatstv.com/audio/acoustic-vibes.mp3" },
  { id: "tropical-house", name: "Tropical House", genre: "House", mood: "Fun", bpm: 105, url: "https://cdn.hapieatstv.com/audio/tropical-house.mp3" },
];

export function duckedVolume(musicVolume: number, voiceoverActive: boolean, duckAmount: number = 0.6): number {
  return voiceoverActive ? musicVolume * (1 - duckAmount) : musicVolume;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function createVoiceoverRecorder(onStateChange?: (state: RecordingState) => void): VoiceoverRecorder {
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let startTime = 0;
  let elapsed = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const updateDuration = (recorder: VoiceoverRecorder) => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      recorder.duration = elapsed + (Date.now() - startTime) / 1000;
    }, 100);
  };

  const recorder: VoiceoverRecorder = {
    state: "idle",
    duration: 0,
    start: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        chunks = [];
        elapsed = 0;
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); if (timer) clearInterval(timer); };
        mediaRecorder.start(100);
        startTime = Date.now();
        recorder.state = "recording";
        onStateChange?.("recording");
        updateDuration(recorder);
      } catch {
        throw new Error("Microphone access denied");
      }
    },
    pause: () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.pause();
        elapsed += (Date.now() - startTime) / 1000;
        recorder.state = "paused";
        onStateChange?.("paused");
        if (timer) clearInterval(timer);
      }
    },
    resume: () => {
      if (mediaRecorder && mediaRecorder.state === "paused") {
        mediaRecorder.resume();
        startTime = Date.now();
        recorder.state = "recording";
        onStateChange?.("recording");
        updateDuration(recorder);
      }
    },
    stop: async () => {
      return new Promise((resolve) => {
        if (!mediaRecorder) { resolve(null); return; }
        const stream = mediaRecorder.stream;
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (timer) clearInterval(timer);
          const blob = new Blob(chunks, { type: "audio/webm" });
          recorder.state = "done";
          onStateChange?.("done");
          resolve(blob);
        };
        mediaRecorder.stop();
      });
    },
    onStateChange: onStateChange || (() => {}),
  };

  return recorder;
}

export async function analyzeAudio(url: string): Promise<{ duration: number; waveform: number[] }> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = url;
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      const waveform = Array.from({ length: 40 }, (_, i) => 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((i / 40) * Math.PI * 6 + Math.sin((i / 40) * Math.PI * 3) * 1.5)));
      resolve({ duration, waveform });
    };
    audio.onerror = () => reject(new Error("Failed to load audio"));
  });
}
