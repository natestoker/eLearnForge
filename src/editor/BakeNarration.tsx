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

  const setAsNarration = (result: BakeResult) => {
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (!s) return;
      const seconds = Math.round(result.seconds * 10) / 10;
      const vName = voiceName(result.voiceId);
      s.timeline = s.timeline ?? { duration: Math.max(1, seconds), autoAdvance: false };
      s.timeline.duration = Math.max(s.timeline.duration, seconds);
      const block = createBlock('audio', 40, s.height - 96);
      // Name the track after the voice it was baked with, so the timeline and
      // layers list show which narrator this clip is.
      block.name = `Narration (${vName})`;
      const ap = block.props as AudioProps;
      ap.src = result.dataUrl;
      ap.label = `Narration — ${vName}`;
      ap.controls = false;
      ap.hideInPlayer = true;
      block.timing = { start: 0, end: seconds };
      s.layers[0].blocks.push(block);
      s.timeline.narrationSrc = undefined;
      // Also drops in time-aligned captions so the player can show them over
      // the stage (toggle in Player settings).
      if (result.captionsVtt) s.timeline.captionsVtt = result.captionsVtt;
    });
  };

  const hasCaptions = Boolean(slide?.timeline?.captionsVtt);
  // The hidden narration track "Set as narration" creates, if one exists -
  // deletable here so re-baking from edited notes is a two-click round trip.
  const narrationTracks = (slide?.layers ?? []).flatMap((l) =>
    l.blocks.filter((b) => b.type === 'audio' && (b.props as AudioProps).hideInPlayer)
  );

  return (
    <>
      <div className="field" style={{ marginBottom: 8 }}>
        <span className="field-label">Speaker notes (the narration script)</span>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Type what the narrator should say on this slide..."
          value={slide?.notes ?? ''}
          onChange={(e) =>
            mutate((p) => {
              const s = p.slides.find((sl) => sl.id === slideId);
              if (s) s.notes = e.target.value || undefined;
            }, false)
          }
        />
      </div>
      {narrationTracks.length > 0 && (
        <p className="caption-status ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ Narration track on this slide ({narrationTracks[0].name ?? 'Narration'}).
          <button
            className="btn btn-ghost btn-danger"
            title="Delete the narration track (notes and captions stay; bake again any time)"
            onClick={() =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slideId);
                if (!s) return;
                for (const l of s.layers) {
                  l.blocks = l.blocks.filter((b) => !(b.type === 'audio' && (b.props as AudioProps).hideInPlayer));
                }
              })
            }
          >
            Remove
          </button>
        </p>
      )}
      {slide?.timeline && (
        <p className={`caption-status ${hasCaptions ? 'ok' : 'missing'}`}>
          {hasCaptions ? '✓ This slide has captions.' : '✗ No captions on this slide yet - use "Set as narration" below.'}
        </p>
      )}
      <AudioBaker
        text={notes}
        bakeLabel="Bake narration"
        emptyHint="Type speaker notes above, then bake them into narration."
        resultActions={(r) => (
          <>
            <button className="btn" onClick={() => downloadBake(r, baseName)}>Download .mp3</button>
            <button className="btn btn-accent" onClick={() => setAsNarration(r)} title="Hidden track that sets the slide length and writes captions">Set as narration</button>
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
