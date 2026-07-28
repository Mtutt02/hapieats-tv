import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TemplateId } from "./templates";

export type AudioTrack = {
  src: string;
  volume?: number;
  startAt?: number;
  fadeIn?: number;
  fadeOut?: number;
};

export type Clip = {
  src: string;
  caption?: string;
  durationInFrames: number;
  startAt: number;
};

export type HapieatsVideoProps = {
  title: string;
  template: TemplateId;
  clips: Clip[];
  backgroundMusic: AudioTrack | null;
  voiceover: AudioTrack | null;
  templateFields: Record<string, string | number | string[]>;
};

function TitleScene({ title, template }: { title: string; template: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, from: 0.3, to: 1 });
  const opacity = interpolate(frame, [0, 12], [0, 1]);
  const iconMap: Record<string, string> = { blank: "🎬", recipe: "🍳", review: "⭐", top5: "🏆" };

  return (
    <AbsoluteFill style={{ background: "#080604" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 30%, rgba(255,122,0,0.15), transparent 60%)",
      }} />
      <div style={{
        position: "absolute", top: "37%", left: 0, right: 0,
        textAlign: "center", transform: `scale(${scale})`, opacity,
      }}>
        <div style={{ fontSize: 110, marginBottom: 20 }}>{iconMap[template] || "🎬"}</div>
        <div style={{
          fontSize: 72, fontWeight: 900, color: "#FFD166",
          fontFamily: "Arial", lineHeight: 1.1, padding: "0 50px",
        }}>{title || "HapieatsTV"}</div>
      </div>
    </AbsoluteFill>
  );
}

function RecipeIntro({ fields }: { fields: Record<string, unknown> }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "#0d0a07" }}>
      <div style={{
        position: "absolute", top: 100, left: 60, right: 60,
        opacity, textAlign: "center",
      }}>
        <div style={{ fontSize: 44, color: "#FFD166", fontWeight: 900 }}>
          {String(fields.dishName || "Recipe")}
        </div>
      </div>
      {Boolean(fields.ingredients) && (
        <div style={{
          position: "absolute", top: 220, left: 60, right: 60, bottom: 100,
          opacity: interpolate(frame, [15, 30], [0, 1]),
        }}>
          <div style={{ fontSize: 28, color: "#ff9f1c", fontWeight: 700, marginBottom: 16 }}>
            INGREDIENTS
          </div>
          {(String(fields.ingredients)).split("\n").slice(0, 10).map((line, i) => (
            <div key={i} style={{
              fontSize: 30, color: "white", lineHeight: 1.5,
              opacity: interpolate(frame, [25 + i * 4, 30 + i * 4], [0, 1]),
            }}>• {line}</div>
          ))}
        </div>
      )}
      {Boolean(fields.prepTime) && (
        <div style={{
          position: "absolute", bottom: 60, left: 60, right: 60,
          display: "flex", gap: 24, justifyContent: "center",
          opacity: interpolate(frame, [50, 60], [0, 1]),
          color: "rgba(255,255,255,0.6)", fontSize: 22,
        }}>
          {Boolean(fields.prepTime) && <span>Prep: {String(fields.prepTime)}m</span>}
          {Boolean(fields.cookTime) && <span>Cook: {String(fields.cookTime)}m</span>}
          {Boolean(fields.difficulty) && <span>• {String(fields.difficulty)}</span>}
        </div>
      )}
    </AbsoluteFill>
  );
}

function ReviewIntro({ fields }: { fields: Record<string, unknown> }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const rating = Number(fields.rating) || 0;

  return (
    <AbsoluteFill style={{ background: "#0d0a07" }}>
      <div style={{ position: "absolute", top: 170, left: 60, right: 60, textAlign: "center", opacity }}>
        <div style={{ fontSize: 48, color: "#FFD166", fontWeight: 900, marginBottom: 20 }}>
          {String(fields.title || "Review")}
        </div>
        <div style={{ fontSize: 52, letterSpacing: 8 }}>
          {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
        </div>
        <div style={{ fontSize: 28, color: "#ff9f1c", marginTop: 16 }}>{rating}/5</div>
      </div>
    </AbsoluteFill>
  );
}

function Top5Intro({ fields }: { fields: Record<string, unknown> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, from: 0.5, to: 1 });
  const items = String(fields.items || "").split("\n").filter(Boolean).slice(0, 5);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1a0e06, #080604)" }}>
      <div style={{ position: "absolute", top: 100, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ fontSize: 52, color: "#FFD166", fontWeight: 900, transform: `scale(${scale})` }}>
          {String(fields.listTitle || "Top 5")}
        </div>
      </div>
      <div style={{
        position: "absolute", top: 220, left: 60, right: 60, bottom: 60,
        display: "flex", flexDirection: "column", gap: 10, justifyContent: "center",
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            opacity: interpolate(frame, [20 + i * 6, 25 + i * 6], [0, 1]),
            color: i === 0 ? "#FFD166" : "white",
            fontSize: i === 0 ? 38 : 30, fontWeight: i === 0 ? 900 : 600,
            textAlign: "left", padding: "12px 24px",
            background: i === 0 ? "rgba(255,209,102,0.12)" : "rgba(255,255,255,0.05)",
            borderRadius: 16, marginBottom: 4,
          }}>
            <span style={{ color: "#ff9f1c", marginRight: 14 }}>#{i + 1}</span>
            {item}
          </div>
        ))}
        {Boolean(fields.honorableMention) && String(fields.honorableMention).length > 0 && (
          <div style={{
            marginTop: 16, fontSize: 22, color: "rgba(255,255,255,0.5)",
            textAlign: "center", opacity: interpolate(frame, [50, 60], [0, 1]),
          }}>
            Honorable Mention: {String(fields.honorableMention)}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function ClipScene({ clip, templateFields }: { clip: Clip; templateFields: Record<string, unknown> }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1]);
  const fadeOut = interpolate(frame, [clip.durationInFrames - 15, clip.durationInFrames], [1, 0]);

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={clip.src}
        startFrom={clip.startAt * 30}
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: Math.min(fadeIn, fadeOut) }}
      />
      {(clip.caption || Boolean(templateFields.verdict)) ? (
        <div style={{
          position: "absolute", bottom: 140, left: 50, right: 50,
          opacity: Math.min(fadeIn, fadeOut),
          background: "rgba(0,0,0,0.7)", color: "white", fontSize: 44, fontWeight: 900,
          lineHeight: 1.2, textAlign: "center", padding: "24px 30px",
          borderRadius: 24, border: "2px solid rgba(255,209,102,0.4)",
          fontFamily: "Arial", backdropFilter: "blur(4px)",
        }}>
          {clip.caption || String(templateFields.verdict || "")}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function AudioTracks({ music, voiceover, totalDuration }: {
  music: AudioTrack | null;
  voiceover: AudioTrack | null;
  totalDuration: number;
}) {
  return (
    <>
      {music && <Audio src={music.src} volume={music.volume ?? 0.3} startFrom={music.startAt ? music.startAt * 30 : 0} endAt={totalDuration} />}
      {voiceover && <Audio src={voiceover.src} volume={voiceover.volume ?? 1} startFrom={voiceover.startAt ? voiceover.startAt * 30 : 0} endAt={totalDuration} />}
    </>
  );
}

export const HapieatsComposition = (props: HapieatsVideoProps) => {
  const { clips, backgroundMusic, voiceover, template, templateFields } = props;
  const INTRO_FRAMES = 4 * 30;
  const START_FRAMES = { blank: 0, recipe: 5 * 30, review: 4 * 30, top5: 6 * 30 }[template];
  const totalAudioDuration = clips.reduce((sum, c) => sum + c.durationInFrames, 0) + INTRO_FRAMES + START_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: "#080604" }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <TitleScene title={props.title} template={template} />
      </Sequence>
      {template === "recipe" && (
        <Sequence from={INTRO_FRAMES} durationInFrames={START_FRAMES}>
          <RecipeIntro fields={templateFields} />
        </Sequence>
      )}
      {template === "review" && (
        <Sequence from={INTRO_FRAMES} durationInFrames={START_FRAMES}>
          <ReviewIntro fields={templateFields} />
        </Sequence>
      )}
      {template === "top5" && (
        <Sequence from={INTRO_FRAMES} durationInFrames={START_FRAMES}>
          <Top5Intro fields={templateFields} />
        </Sequence>
      )}
      {(() => {
        let cursor = INTRO_FRAMES + START_FRAMES;
        return clips.map((clip, i) => {
          const from = cursor;
          cursor += clip.durationInFrames;
          return (
            <Sequence key={i} from={from} durationInFrames={clip.durationInFrames}>
              <ClipScene clip={clip} templateFields={templateFields} />
            </Sequence>
          );
        });
      })()}
      <AudioTracks music={backgroundMusic} voiceover={voiceover} totalDuration={totalAudioDuration} />
    </AbsoluteFill>
  );
};
