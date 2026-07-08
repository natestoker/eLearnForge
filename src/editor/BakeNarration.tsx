import { useProjectStore } from '../state/projectStore';
import { createBlock } from '../schema/factory';
import type { AudioProps } from '../schema/types';
import { downloadBake, voiceName, type BakeResult } from './audioBake';
import { AudioBaker } from './AudioBaker';

// Slide-level narration: bake the speaker notes with the shared AudioBaker,
// then place the result - as a downloadable file, a timeline audio block, or
// a hidden narration track that sets the slide length.

export function BakeNarration({ slideId }: { slideId: string }) {
  const mutate = useProjectStore((s) => s.mutate);
  const slide = useProjectStore((s) => s.project.slides.find((sl) => sl.id === slideId));

  const notes = slide?.notes?.trim() ?? '';
  const baseName = `${(slide?.name ?? 'narration').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  const addToTimeline = (result: BakeResult, asNarration: boolean) => {
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (!s) return;
      const seconds = Math.round(result.seconds * 10) / 10;
      const vName = voiceName(result.voiceId);
      s.timeline = s.timeline ?? { duration: Math.max(1, seconds), autoAdvance: false };
      if (asNarration) s.timeline.duration = Math.max(s.timeline.duration, seconds);
      const block = createBlock('audio', 40, s.height - 96);
      // Name the track after the voice it was baked with, so the timeline and
      // layers list show which narrator this clip is.
      block.name = `${asNarration ? 'Narration' : 'Audio'} (${vName})`;
      const ap = block.props as AudioProps;
      ap.src = result.dataUrl;
      ap.label = asNarration ? `Narration — ${vName}` : `Audio — ${vName}`;
      ap.controls = !asNarration;
      ap.hideInPlayer = asNarration;
      block.timing = { start: 0, end: seconds };
      s.layers[0].blocks.push(block);
      s.timeline.narrationSrc = undefined;
      // Narration mode also drops in time-aligned captions so the player can
      // show them over the stage (toggle in Player settings).
      if (asNarration && result.captionsVtt) s.timeline.captionsVtt = result.captionsVtt;
    });
  };

  const hasCaptions = Boolean(slide?.timeline?.captionsVtt);

  return (
    <>
      {slide?.timeline && (
        <p className={`caption-status ${hasCaptions ? 'ok' : 'missing'}`}>
          {hasCaptions ? '✓ This slide has captions.' : '✗ No captions on this slide yet - use "Add as narration" below (not "Add to timeline").'}
        </p>
      )}
      <AudioBaker
        text={notes}
        bakeLabel="Bake narration"
        emptyHint="Add speaker notes above to bake them into narration."
        resultActions={(r) => (
          <>
            <button className="btn" onClick={() => downloadBake(r, baseName)}>Download .mp3</button>
            <button className="btn" onClick={() => addToTimeline(r, false)} title="Adds a visible, controllable audio clip - no captions, doesn't set slide length">Add to timeline</button>
            <button className="btn btn-accent" onClick={() => addToTimeline(r, true)} title="The usual choice for slide narration: hidden track that sets the slide length and writes captions">Add as narration</button>
          </>
        )}
      />
      <p className="hint">
        The voice is synthesized in your browser, so it works the same on every
        OS with no screen-share prompt. The first preview or bake downloads the
        model (about 86MB, one time) - it runs in the background and is then
        cached; the baked file embeds in the course.
      </p>
    </>
  );
}
