import { useCurrentSlide, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { TimingSection } from './TimingSection';
import { Field, SelectInput } from './fields';
import { blockDisplayName } from '../shared/blockName';

// Dedicated animation tab: entrance/exit timing plus a looping emphasis,
// available for every block type (shapes, images, buttons, text, all of
// them) - not just text.
export function AnimatePanel() {
  const slide = useCurrentSlide();
  const block = useSelectedBlock();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const mutate = useProjectStore((s) => s.mutate);

  if (!block) {
    return (
      <div className="panel-body">
        <p className="hint">
          Select a block on the canvas (or its bar in the timeline strip) to
          set its entrance/exit animation and emphasis.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <h3 className="panel-title">Animate - {blockDisplayName(block)}</h3>

      <h4 className="panel-subtitle">Emphasis (loops in the player)</h4>
      <Field label="Emphasis">
        <SelectInput
          value={block.emphasis ?? 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'pulse', label: 'Pulse' },
            { value: 'heartbeat', label: 'Heartbeat' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'float', label: 'Float' },
            { value: 'wobble', label: 'Wobble' },
            { value: 'tada', label: 'Tada' },
            { value: 'glow', label: 'Glow' },
            { value: 'shake', label: 'Shake' }
          ]}
          onChange={(v) => updateBlock(block.id, (b) => { b.emphasis = v === 'none' ? undefined : (v as 'pulse'); })}
        />
      </Field>

      <div className="divider" />
      <h4 className="panel-subtitle">Entrance / exit (on the timeline)</h4>
      {!slide.timeline ? (
        <>
          <p className="hint">Entrance/exit animations run on the slide timeline.</p>
          <button
            className="btn"
            onClick={() =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (s) s.timeline = { duration: 10, autoAdvance: false };
              })
            }
          >
            Add a timeline to this slide
          </button>
        </>
      ) : (
        <TimingSection
          block={block}
          onUpdate={(fn, history = true) => updateBlock(block.id, (b) => fn(b), history)}
        />
      )}
    </div>
  );
}
