import { Composition } from "remotion";
import { HapieatsComposition } from "./HapieatsComposition";

export type { Clip, AudioTrack, HapieatsVideoProps } from "./HapieatsComposition";
export type { TemplateId } from "./templates";

export const RemotionRoot = () => {
  return (
    <Composition
      id="HapieatsTVVideo"
      component={HapieatsComposition}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        title: "HapieatsTV",
        template: "blank",
        clips: [],
        backgroundMusic: null,
        voiceover: null,
        templateFields: {},
      }}
    />
  );
};
