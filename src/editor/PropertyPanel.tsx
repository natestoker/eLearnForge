import { useCurrentSlide, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { BLOCKS } from '../blocks/registry';
import { CheckboxInput, ColorInput, Field, ImagePicker, NumberInput, Row, SelectInput, TextInput } from './fields';
import { VoiceRecorder } from './VoiceRecorder';
import { StatesSection } from './StatesSection';
import { BakeNarration } from './BakeNarration';
import { defaultPlayerSettings } from '../schema/factory';
import { useEffect, useState } from 'react';

// useVoices removed

// Panel design note (open question #2 from the brief): hand-built panels per
// block type for v1's four blocks, sharing field primitives. A schema-driven
// form engine is a v2 door once the library is big enough to earn it.

export function PropertyPanel() {
  const block = useSelectedBlock();
  const slide = useCurrentSlide();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const moveBlockZ = useProjectStore((s) => s.moveBlockZ);
  const deleteBlock = useProjectStore((s) => s.deleteBlock);
  const mutate = useProjectStore((s) => s.mutate);

  if (!block) {
    return (
      <div className="panel-scroll">
        <h3 className="panel-title">Slide</h3>
        <Field label="Name">
          <TextInput
            value={slide.name}
            onChange={(v) =>
              mutate((p) => {
                const s = p.slides.find((sl) => sl.id === slide.id);
                if (s) s.name = v;
              })
            }
          />
        </Field>
        <Row>
          <Field label="Width">
            <NumberInput
              value={slide.width}
              min={320}
              onChange={(v) =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s) s.width = v;
                })
              }
            />
          </Field>
          <Field label="Height">
            <NumberInput
              value={slide.height}
              min={240}
              onChange={(v) =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s) s.height = v;
                })
              }
            />
          </Field>
        </Row>
        <div className="divider" />
        <h3 className="panel-title">Timeline</h3>
        {!slide.timeline ? (
          <>
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
            <p className="hint">
              A timeline gives the slide a clock, play/seek controls, block
              entrance and exit animations, and optional narration audio.
            </p>
          </>
        ) : (
          <>
            <Field label="Duration (seconds)">
              <NumberInput
                value={slide.timeline.duration}
                min={1}
                onChange={(v) =>
                  mutate((p) => {
                    const s = p.slides.find((sl) => sl.id === slide.id);
                    if (s?.timeline) s.timeline.duration = Math.max(1, v);
                  })
                }
              />
            </Field>
            <Field label="Narration audio (drives the clock)">
              <ImagePicker
                accept="audio/*"
                src={slide.timeline.narrationSrc ?? ''}
                onChange={(v) =>
                  mutate((p) => {
                    const s = p.slides.find((sl) => sl.id === slide.id);
                    if (s?.timeline) s.timeline.narrationSrc = v || undefined;
                  })
                }
              />
            </Field>
            <VoiceRecorder
              onRecorded={(dataUrl, seconds) =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s?.timeline) {
                    s.timeline.narrationSrc = dataUrl;
                    s.timeline.duration = Math.max(1, Math.round(seconds * 10) / 10);
                    s.timeline.tts = undefined; // recorded voice replaces TTS
                  }
                })
              }
            />
            {/* Narrate speaker notes (browser text-to-speech) removed */}
            <CheckboxInput
              label="Auto-advance to the next slide at the end"
              checked={slide.timeline.autoAdvance}
              onChange={(v) =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s?.timeline) s.timeline.autoAdvance = v;
                })
              }
            />
            <button
              className="btn btn-ghost btn-danger"
              onClick={() =>
                mutate((p) => {
                  const s = p.slides.find((sl) => sl.id === slide.id);
                  if (s) s.timeline = undefined;
                })
              }
            >
              Remove timeline
            </button>
          </>
        )}
        <div className="divider" />
        <h3 className="panel-title">Course theme</h3>
        <Field label="Accent color (new shapes and buttons)">
          <ColorInput
            value={useProjectStore.getState().project.theme?.accent ?? '#3ddc97'}
            onChange={(v) => mutate((p) => { p.theme = { accent: v }; })}
          />
        </Field>
        <Field label="Slide transition (GSAP)">
          <SelectInput
            value={useProjectStore.getState().project.slideTransition ?? 'none'}
            options={[
              { value: 'none', label: 'None' },
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'zoom', label: 'Zoom' }
            ]}
            onChange={(v) => mutate((p) => { p.slideTransition = v === 'none' ? undefined : (v as 'fade'); })}
          />
        </Field>
        <div className="divider" />
        <h3 className="panel-title">Player</h3>
        <PlayerSettingsSection />
        <div className="divider" />
        <h3 className="panel-title">Speaker notes</h3>
        <textarea
          className="input code-area"
          rows={4}
          placeholder="Notes for this slide. TTS narration reads this text."
          value={slide.notes ?? ''}
          onChange={(e) =>
            mutate((p) => {
              const s = p.slides.find((sl) => sl.id === slide.id);
              if (s) s.notes = e.target.value || undefined;
            })
          }
        />
        <div className="divider" />
        <h3 className="panel-title">Bake narration to a file</h3>
        <BakeNarration slideId={slide.id} />
        <div className="divider" />
        <p className="hint">Select a block on the canvas to edit its properties.</p>
      </div>
    );
  }

  const def = BLOCKS[block.type];

  return (
    <div className="panel-scroll">
      <h3 className="panel-title">{def.label} block</h3>
      <Field label="Name">
        <TextInput
          value={block.name ?? ''}
          placeholder={def.label}
          onChange={(v) => updateBlock(block.id, (b) => { b.name = v || undefined; })}
        />
      </Field>
      <Field label="Initial state">
        <SelectInput
          value={block.initialState ?? 'normal'}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'hidden', label: 'Hidden' }
          ]}
          onChange={(v) => updateBlock(block.id, (b) => { b.initialState = v === 'normal' ? undefined : (v as 'hidden'); })}
        />
      </Field>
      <Field label="Screen readers">
        <SelectInput
          value={block.aria ?? 'auto'}
          options={[
            { value: 'auto', label: 'Auto (only if it has text)' },
            { value: 'include', label: 'Always include' },
            { value: 'exclude', label: 'Always exclude' }
          ]}
          onChange={(v) => updateBlock(block.id, (b) => { b.aria = v === 'auto' ? undefined : (v as 'include' | 'exclude'); })}
        />
      </Field>
      {(block.aria === 'include' || (block.aria ?? 'auto') === 'auto') && (
        <Field label="Screen-reader label (optional)">
          <TextInput
            value={block.accLabel ?? ''}
            placeholder="Overrides the announced text"
            onChange={(v) => updateBlock(block.id, (b) => { b.accLabel = v || undefined; })}
          />
        </Field>
      )}
      <Row>
        <Field label="X">
          <NumberInput value={Math.round(block.x)} onChange={(v) => updateBlock(block.id, (b) => { b.x = v; })} />
        </Field>
        <Field label="Y">
          <NumberInput value={Math.round(block.y)} onChange={(v) => updateBlock(block.id, (b) => { b.y = v; })} />
        </Field>
      </Row>
      <Row>
        <Field label="W">
          <NumberInput value={Math.round(block.w)} min={40} onChange={(v) => updateBlock(block.id, (b) => { b.w = v; })} />
        </Field>
        <Field label="H">
          <NumberInput value={Math.round(block.h)} min={40} onChange={(v) => updateBlock(block.id, (b) => { b.h = v; })} />
        </Field>
      </Row>
      <div className="divider" />
      <def.Properties
        block={block}
        onUpdateProps={(fn, history = true) => updateBlock(block.id, (b) => fn(b.props), history)}
      />
      {(block.type === 'shape' || block.type === 'button' || block.type === 'image' || block.type === 'text' || block.type === 'hotspot') && (
        <>
          <div className="divider" />
          <h3 className="panel-title">States</h3>
          <StatesSection
            block={block}
            onUpdate={(fn) => updateBlock(block.id, (b) => fn(b))}
          />
        </>
      )}
      <Field label="Emphasis (looping attention animation)">
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
      <h3 className="panel-title">Align</h3>
      <AlignControls />
      <GroupControls />
      <div className="divider" />
      <h3 className="panel-title">Order</h3>
      <div className="z-order-row">
        <button className="btn" onClick={() => moveBlockZ(block.id, 'back')} title="Send to back">To back</button>
        <button className="btn" onClick={() => moveBlockZ(block.id, 'backward')} title="Send backward">Back</button>
        <button className="btn" onClick={() => moveBlockZ(block.id, 'forward')} title="Bring forward">Fwd</button>
        <button className="btn" onClick={() => moveBlockZ(block.id, 'front')} title="Bring to front">To front</button>
      </div>
      <div className="divider" />
      <h3 className="panel-title">Clipboard</h3>
      <ClipboardControls />
      <p className="hint">
        Cut/copy, then select another layer or slide and paste to move blocks
        between them. Shift-click blocks on the canvas to select several.
      </p>
      <div className="divider" />
      <button className="btn btn-danger-solid" onClick={() => deleteBlock(block.id)}>
        Delete block
      </button>
    </div>
  );
}


// TtsControls removed


function PlayerSettingsSection() {
  const mutate = useProjectStore((s) => s.mutate);
  const player = useProjectStore((s) => s.project.player) ?? defaultPlayerSettings();
  const setBtn = (key: 'next' | 'back' | 'submit', patch: Partial<{ show: boolean; label: string }>) =>
    mutate((p) => {
      p.player = p.player ?? defaultPlayerSettings();
      p.player[key] = { ...p.player[key], ...patch };
    });
  return (
    <>
      {(['back', 'next', 'submit'] as const).map((key) => (
        <Row key={key}>
          <CheckboxInput
            label={key}
            checked={player[key].show}
            onChange={(v) => setBtn(key, { show: v })}
          />
          <TextInput
            value={player[key].label}
            onChange={(v) => setBtn(key, { label: v })}
          />
        </Row>
      ))}
      <CheckboxInput
        label="Menu button (slide list)"
        checked={player.menu.show}
        onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.menu.show = v; })}
      />
      {player.menu.show && (
        <CheckboxInput
          label="Lock menu (view-only, no jumping ahead)"
          checked={player.menu.locked ?? false}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.menu.locked = v || undefined; })}
        />
      )}
      <CheckboxInput
        label="Course progress bar"
        checked={player.progressBar ?? false}
        onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.progressBar = v || undefined; })}
      />
      <Field label="Player accent">
        <ColorInput
          value={player.accent ?? useProjectStore.getState().project.theme?.accent ?? '#3ddc97'}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.accent = v; })}
        />
      </Field>
      <Row>
        <Field label="Chrome">
          <SelectInput
            value={player.chrome ?? 'dark'}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'minimal', label: 'Minimal' }]}
            onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.chrome = v as 'dark'; })}
          />
        </Field>
        <Field label="Buttons">
          <SelectInput
            value={player.buttonShape ?? 'rounded'}
            options={[{ value: 'rounded', label: 'Rounded' }, { value: 'pill', label: 'Pill' }, { value: 'square', label: 'Square' }]}
            onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.buttonShape = v as 'rounded'; })}
          />
        </Field>
      </Row>
      <Field label="Button style">
        <SelectInput
          value={player.buttonStyle ?? 'solid'}
          options={[{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }]}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.buttonStyle = v as 'solid'; })}
        />
      </Field>
      {/* Learner voice controls on TTS slides removed */}
      <p className="hint">Triggers can also enable/disable Next, Back, and Submit per slide (Enable/disable player button action).</p>
    </>
  );
}

function AlignControls() {
  const alignBlocks = useProjectStore((s) => s.alignBlocks);
  const distributeBlocks = useProjectStore((s) => s.distributeBlocks);
  const selection = useProjectStore((s) => s.selection);
  const multi = (selection.blockIds ?? []).length + (selection.blockId ? 1 : 0) >= 2;
  const [override, setOverride] = useState<'stage' | 'selection' | null>(null);
  // Default: align to the stage when one block is selected, to each other
  // when several are. An explicit click on either chip overrides that.
  const target = override ?? (multi ? 'selection' : 'stage');
  const setTo = (t: 'stage' | 'selection') => setOverride(t);
  return (
    <div className="align-controls">
      <div className="align-target">
        <button className={`chip ${target === 'stage' ? 'on' : ''}`} onClick={() => setTo('stage')}>To stage</button>
        <button
          className={`chip ${target === 'selection' ? 'on' : ''}`}
          onClick={() => setTo('selection')}
          disabled={!multi}
          title={multi ? 'Align to the selection bounds' : 'Shift-click 2+ blocks first'}
        >
          To each other
        </button>
      </div>
      <div className="align-grid">
        <button className="btn btn-icon" title="Align left" onClick={() => alignBlocks('left', target)}>{'\u2596'}</button>
        <button className="btn btn-icon" title="Center horizontally" onClick={() => alignBlocks('hcenter', target)}>{'\u2503'}</button>
        <button className="btn btn-icon" title="Align right" onClick={() => alignBlocks('right', target)}>{'\u2597'}</button>
        <button className="btn btn-icon" title="Align top" onClick={() => alignBlocks('top', target)}>{'\u2594'}</button>
        <button className="btn btn-icon" title="Center vertically" onClick={() => alignBlocks('vcenter', target)}>{'\u2501'}</button>
        <button className="btn btn-icon" title="Align bottom" onClick={() => alignBlocks('bottom', target)}>{'\u2581'}</button>
      </div>
      <div className="field-row">
        <button className="btn" onClick={() => distributeBlocks('h')} disabled={!multi} title="Distribute horizontally (3+)">Distribute H</button>
        <button className="btn" onClick={() => distributeBlocks('v')} disabled={!multi} title="Distribute vertically (3+)">Distribute V</button>
      </div>
      <p className="hint"><strong>Shift-click</strong> two or more blocks on the stage, then use “To each other.”</p>
    </div>
  );
}

function ClipboardControls() {
  const copyBlocks = useProjectStore((s) => s.copyBlocks);
  const cutBlocks = useProjectStore((s) => s.cutBlocks);
  const pasteBlocks = useProjectStore((s) => s.pasteBlocks);
  return (
    <div className="z-order-row">
      <button className="btn" onClick={copyBlocks} title="Copy (Ctrl/Cmd+C)">Copy</button>
      <button className="btn" onClick={cutBlocks} title="Cut (Ctrl/Cmd+X)">Cut</button>
      <button className="btn" onClick={pasteBlocks} title="Paste to the selected layer (Ctrl/Cmd+V)">Paste here</button>
    </div>
  );
}

function GroupControls() {
  const groupBlocks = useProjectStore((s) => s.groupBlocks);
  const ungroupBlocks = useProjectStore((s) => s.ungroupBlocks);
  const selection = useProjectStore((s) => s.selection);
  const project = useProjectStore((s) => s.project);
  const ids = [...(selection.blockIds ?? []), ...(selection.blockId ? [selection.blockId] : [])];
  const all = project.slides.flatMap((s) => s.layers.flatMap((l) => l.blocks));
  const selBlocks = all.filter((b) => ids.includes(b.id));
  const anyGrouped = selBlocks.some((b) => b.groupId);
  const canGroup = ids.length >= 2;
  return (
    <div className="field-row" style={{ marginTop: 8 }}>
      <button className="btn" onClick={groupBlocks} disabled={!canGroup} title="Group selected (Ctrl/Cmd+G)">Group</button>
      <button className="btn" onClick={ungroupBlocks} disabled={!anyGrouped} title="Ungroup (Ctrl/Cmd+Shift+G)">Ungroup</button>
    </div>
  );
}
