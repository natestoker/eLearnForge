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
  const selection = useProjectStore((s) => s.selection);
  // Narration targets the SELECTED layer: a non-base layer gets the audio as
  // its own timeline's clock (layer.timeline.narrationSrc); the base layer
  // keeps the hidden-track approach on the slide timeline.
  const selLayer = slide?.layers.find((l) => l.id === selection.layerId);
  const targetLayer = selLayer && slide && slide.layers[0]?.id !== selLayer.id ? selLayer : null;

  // Script + narration are per-target: a layer keeps its OWN notes, separate
  // from the slide's speaker notes.
  const notes = (targetLayer ? targetLayer.notes : slide?.notes)?.trim() ?? '';
  const setNotes = (v: string) =>
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (!s) return;
      if (targetLayer) { const l = s.layers.find((x) => x.id === targetLayer.id); if (l) l.notes = v || undefined; }
      else s.notes = v || undefined;
    }, false);
  const baseName = `${(slide?.name ?? 'narration').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  const setAsNarration = (result: BakeResult) => {
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slideId);
      if (!s) return;
      const seconds = Math.round(result.seconds * 10) / 10;
      const vName = voiceName(result.voiceId);
      if (targetLayer) {
        // Layer narration: the audio IS the layer's clock, so visuals and
        // voice can never drift and the seekbar follows it.
        const l = s.layers.find((x) => x.id === targetLayer.id);
        if (!l) return;
        l.timeline = l.timeline ?? { duration: Math.max(1, seconds), autoAdvance: false };
        l.timeline.narrationSrc = result.dataUrl;
        l.timeline.duration = Math.max(l.timeline.duration, seconds);
        if (result.captionsVtt) l.timeline.captionsVtt = result.captionsVtt;
        return;
      }
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
  const layerNarration = Boolean(targetLayer?.timeline?.narrationSrc);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <span className="field-label">
          {targetLayer ? `Narration script for the "${targetLayer.name}" layer` : 'Speaker notes (the slide narration script)'}
        </span>
        <textarea
          className="input textarea narration-notes"
          rows={8}
          placeholder={targetLayer ? `What the narrator says while the "${targetLayer.name}" layer is up...` : 'Type what the narrator should say on this slide...'}
          value={(targetLayer ? targetLayer.notes : slide?.notes) ?? ''}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {targetLayer && (
        <p className="hint" style={{ marginTop: 0 }}>
          Narration will attach to the <b>{targetLayer.name}</b> layer as its own
          timeline's audio (select the base layer first for slide narration).
        </p>
      )}
      {layerNarration && (
        <p className="caption-status ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ This layer has narration (it drives the layer's timeline).
          <button
            className="btn btn-ghost btn-danger"
            onClick={() =>
              mutate((p) => {
                const l = p.slides.find((sl) => sl.id === slideId)?.layers.find((x) => x.id === targetLayer!.id);
                if (l?.timeline) l.timeline.narrationSrc = undefined;
              })
            }
          >
            Remove
          </button>
        </p>
      )}
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
