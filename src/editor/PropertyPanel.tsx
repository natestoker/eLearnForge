import { selectedIds, useCurrentSlide, useProjectStore, useSelectedBlock, walkBlocks } from '../state/projectStore';
import type { Block, ButtonProps, ShapeProps, TextProps } from '../schema/types';
import { BLOCKS } from '../blocks/registry';
import { CheckboxInput, ColorInput, Field, ImagePicker, NumberInput, RangeInput, Row, SelectInput, TextInput } from './fields';
import { GOOGLE_FONTS, SYSTEM_FONTS, ensureFont } from '../shared/fonts';
import { VoiceRecorder } from './VoiceRecorder';
import { ShadowSection } from './ShadowSection';
import { BakeNarration } from './BakeNarration';
import { BlockAudioSection } from './BlockAudioSection';
import { defaultPlayerSettings, uid } from '../schema/factory';
import { useState } from 'react';

// Panel design note (open question #2 from the brief): hand-built panels per
// block type for v1's four blocks, sharing field primitives. A schema-driven
// form engine is a v2 door once the library is big enough to earn it.

export function PropertyPanel() {
  const block = useSelectedBlock();
  const slide = useCurrentSlide();
  const selection = useProjectStore((s) => s.selection);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const moveBlockZ = useProjectStore((s) => s.moveBlockZ);
  const deleteBlock = useProjectStore((s) => s.deleteBlock);
  const mutate = useProjectStore((s) => s.mutate);

  // 2+ blocks selected: shared editing is the workflow, not an edge case -
  // one panel that writes common settings to the whole selection.
  const multiIds = selectedIds(selection);
  if (multiIds.length >= 2) return <MultiPropertyPanel ids={multiIds} />;

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
                  }
                })
              }
            />
            <Field label="Captions (WebVTT) — auto-filled by Bake narration">
              <textarea
                className="input code-area"
                rows={4}
                placeholder={'Baking narration fills this in. You can also paste WEBVTT cues here.'}
                value={slide.timeline.captionsVtt ?? ''}
                onChange={(e) =>
                  mutate((p) => {
                    const s = p.slides.find((sl) => sl.id === slide.id);
                    if (s?.timeline) s.timeline.captionsVtt = e.target.value || undefined;
                  })
                }
              />
            </Field>
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
              { value: 'slide', label: 'Slide (subtle)' },
              { value: 'slideLeft', label: 'Slide from right' },
              { value: 'slideRight', label: 'Slide from left' },
              { value: 'slideUp', label: 'Slide up' },
              { value: 'zoom', label: 'Zoom in' },
              { value: 'zoomOut', label: 'Zoom out' },
              { value: 'flip', label: 'Flip' }
            ]}
            onChange={(v) => mutate((p) => { p.slideTransition = v === 'none' ? undefined : (v as 'fade'); })}
          />
        </Field>
        <div className="divider" />
        <h3 className="panel-title">Player</h3>
        <PlayerSettingsSection />
        <div className="divider" />
        <h3 className="panel-title">Resources</h3>
        <ResourcesEditor />
        <div className="divider" />
        <h3 className="panel-title">Glossary</h3>
        <GlossaryEditor />
        <div className="divider" />
        <h3 className="panel-title">Speaker notes</h3>
        <textarea
          className="input code-area"
          rows={4}
          placeholder="Notes for this slide. Bake narration reads this text."
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
      <Row>
        <Field label="Rotation (deg)">
          <NumberInput
            value={block.rotation ?? 0}
            step={15}
            onChange={(v) => updateBlock(block.id, (b) => { b.rotation = v ? ((v % 360) + 360) % 360 : undefined; })}
          />
        </Field>
        <Field label="Lock">
          <button
            className="btn"
            style={block.locked ? { color: '#e94b5a' } : undefined}
            onClick={() => updateBlock(block.id, (b) => { b.locked = b.locked ? undefined : true; })}
            title="A locked block can be selected but not moved, resized, or retimed"
          >
            {block.locked ? '\u{1F512} Locked' : '\u{1F513} Unlocked'}
          </button>
        </Field>
      </Row>
      <div className="divider" />
      <def.Properties
        block={block}
        onUpdateProps={(fn, history = true) => updateBlock(block.id, (b) => fn(b.props), history)}
      />
      {block.type === 'text' && (
        <>
          <div className="divider" />
          <h3 className="panel-title">Audio</h3>
          <BlockAudioSection block={block} />
        </>
      )}
      <div className="divider" />
      <p className="hint">Shadow, reflection, and interactive states now live on the <strong>Effects</strong> tab.</p>
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


// Shared editing for a multi-selection: common settings write to every
// selected block (where the property applies), and the selection-level
// tools (align, distribute, group, delete) live right here.
function MultiPropertyPanel({ ids }: { ids: string[] }) {
  const slide = useCurrentSlide();
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const mutate = useProjectStore((s) => s.mutate);
  const select = useProjectStore((s) => s.select);
  const blocks = slide.layers.flatMap((l) => walkBlocks(l.blocks)).filter((b) => ids.includes(b.id));
  if (blocks.length < 2) return null;
  const first = blocks[0];

  const each = (fn: (b: Block) => void) => {
    mutate((p) => {
      const s = p.slides.find((sl) => sl.id === slide.id);
      if (!s) return;
      for (const l of s.layers) {
        for (const b of walkBlocks(l.blocks)) if (ids.includes(b.id)) fn(b);
      }
    });
  };

  const fillables = blocks.filter((b) => b.type === 'shape' || b.type === 'button');
  const shapes = blocks.filter((b) => b.type === 'shape');
  const texts = blocks.filter((b) => b.type === 'text');
  const anyLocked = blocks.some((b) => b.locked);
  const firstText = texts[0]?.props as TextProps | undefined;
  const firstShape = shapes[0]?.props as ShapeProps | undefined;

  return (
    <div className="panel-scroll">
      <h3 className="panel-title">{blocks.length} blocks selected</h3>
      <p className="hint">Changes apply to every selected block. Drag the dashed box's corner on the canvas to resize together (Shift keeps proportions).</p>
      {fillables.length > 0 && (
        <Field label={`Fill (${fillables.length})`}>
          <ColorInput
            value={(fillables[0].props as ShapeProps | ButtonProps).fill ?? '#3ddc97'}
            onChange={(v) => each((b) => {
              if (b.type === 'shape' || b.type === 'button') (b.props as { fill?: string }).fill = v;
            })}
          />
        </Field>
      )}
      {shapes.length > 0 && firstShape && (
        <>
          <Row>
            <Field label="Border">
              <ColorInput
                value={firstShape.borderColor}
                onChange={(v) => each((b) => { if (b.type === 'shape') (b.props as ShapeProps).borderColor = v; })}
              />
            </Field>
            <Field label="Border width">
              <NumberInput
                value={firstShape.borderWidth}
                min={0}
                onChange={(v) => each((b) => { if (b.type === 'shape') (b.props as ShapeProps).borderWidth = Math.max(0, v); })}
              />
            </Field>
          </Row>
          <Field label={`Corner radius (${shapes.length})`}>
            <NumberInput
              value={firstShape.cornerRadius}
              min={0}
              onChange={(v) => each((b) => { if (b.type === 'shape') (b.props as ShapeProps).cornerRadius = Math.max(0, v); })}
            />
          </Field>
        </>
      )}
      {texts.length > 0 && firstText && (
        <>
          <Row>
            <Field label={`Font size (${texts.length})`}>
              <NumberInput
                value={firstText.fontSize}
                min={6}
                onChange={(v) => each((b) => { if (b.type === 'text') (b.props as TextProps).fontSize = Math.max(6, v); })}
              />
            </Field>
            <Field label="Text color">
              <ColorInput
                value={firstText.color ?? '#e7e9ec'}
                onChange={(v) => each((b) => { if (b.type === 'text') (b.props as TextProps).color = v; })}
              />
            </Field>
          </Row>
          <Field label="Font (text)">
            <SelectInput
              value={firstText.fontFamily ?? ''}
              options={[
                { value: '', label: 'JetBrains Mono (default)' },
                ...SYSTEM_FONTS.map((f) => ({ value: f.family, label: `${f.family} (System)` })),
                ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: `${f.family} (${f.category})` }))
              ]}
              onChange={(v) => {
                if (v) { ensureFont(v); mutate((p) => { p.fonts = [...new Set([...(p.fonts ?? []), v])]; }); }
                each((b) => { if (b.type === 'text') (b.props as TextProps).fontFamily = v || undefined; });
              }}
            />
          </Field>
          <Row>
            <Field label="Align">
              <SelectInput
                value={firstText.align}
                options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
                onChange={(v) => each((b) => { if (b.type === 'text') (b.props as TextProps).align = v as TextProps['align']; })}
              />
            </Field>
            <Field label="Weight">
              <RangeInput
                value={firstText.fontWeight ?? (firstText.bold ? 700 : 400)}
                min={100} max={900} step={100}
                onChange={(v) => each((b) => {
                  if (b.type === 'text') {
                    const tp = b.props as TextProps;
                    tp.fontWeight = v === 400 ? undefined : v;
                    tp.bold = v >= 700 ? true : undefined;
                  }
                })}
              />
            </Field>
          </Row>
        </>
      )}
      <Row>
        <Field label="Width (all)">
          <NumberInput value={Math.round(first.w)} min={20} onChange={(v) => each((b) => { b.w = Math.max(20, v); })} />
        </Field>
        <Field label="Height (all)">
          <NumberInput value={Math.round(first.h)} min={20} onChange={(v) => each((b) => { b.h = Math.max(20, v); })} />
        </Field>
      </Row>
      <Row>
        <Field label="Rotation (deg)">
          <NumberInput
            value={first.rotation ?? 0}
            step={15}
            onChange={(v) => each((b) => { b.rotation = v ? ((v % 360) + 360) % 360 : undefined; })}
          />
        </Field>
        <Field label="Lock">
          <button
            className="btn"
            style={anyLocked ? { color: '#e94b5a' } : undefined}
            onClick={() => each((b) => { b.locked = anyLocked ? undefined : true; })}
          >
            {anyLocked ? '\u{1F513} Unlock all' : '\u{1F512} Lock all'}
          </button>
        </Field>
      </Row>
      <Field label="Emphasis (all)">
        <SelectInput
          value={first.emphasis ?? 'none'}
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
          onChange={(v) => each((b) => { b.emphasis = v === 'none' ? undefined : (v as 'pulse'); })}
        />
      </Field>
      <div className="divider" />
      <h3 className="panel-title">Shadow (all)</h3>
      <ShadowSection
        block={first}
        onUpdate={(fn) => { ids.forEach((id) => updateBlock(id, (b) => fn(b), id === ids[0])); }}
      />
      <div className="divider" />
      <h3 className="panel-title">Align</h3>
      <AlignControls />
      <GroupControls />
      <div className="divider" />
      <button
        className="btn btn-danger-solid"
        onClick={() => {
          mutate((p) => {
            const s = p.slides.find((sl) => sl.id === slide.id);
            if (!s) return;
            const idSet = new Set(ids);
            for (const l of s.layers) {
              l.blocks = l.blocks.filter((b) => !idSet.has(b.id));
            }
          });
          select({ blockId: null, blockIds: [] });
        }}
      >
        Delete {blocks.length} blocks
      </button>
    </div>
  );
}

// Course-level downloadable resources shown in the player's Resources panel.
function ResourcesEditor() {
  const resources = useProjectStore((s) => s.project.resources) ?? [];
  const mutate = useProjectStore((s) => s.mutate);
  const add = () => mutate((p) => { p.resources = [...(p.resources ?? []), { id: uid('res'), title: 'New resource', url: '' }]; });
  const update = (id: string, patch: Partial<{ title: string; url: string; description: string }>) =>
    mutate((p) => { const r = p.resources?.find((x) => x.id === id); if (r) Object.assign(r, patch); });
  const remove = (id: string) => mutate((p) => { if (p.resources) p.resources = p.resources.filter((x) => x.id !== id); });
  const onFile = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => update(id, { url: String(reader.result), title: file.name });
    reader.readAsDataURL(file);
  };
  return (
    <>
      {resources.map((r) => (
        <div key={r.id} className="mini-card">
          <Row>
            <Field label="Title"><TextInput value={r.title} onChange={(v) => update(r.id, { title: v })} /></Field>
            <button className="btn btn-ghost btn-icon btn-danger" title="Remove" onClick={() => remove(r.id)}>x</button>
          </Row>
          <Field label="Link (URL) or upload a file">
            <ImagePicker accept="*/*" src={r.url} onChange={(v) => update(r.id, { url: v })} />
          </Field>
          <input
            type="file"
            className="input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(r.id, f); e.target.value = ''; }}
          />
        </div>
      ))}
      <button className="btn" onClick={add}>+ Add resource</button>
      <p className="hint">Learners open these from the Resources button in the player. Uploaded files embed in the course.</p>
    </>
  );
}

// Course-level glossary shown in the player's Glossary panel.
function GlossaryEditor() {
  const glossary = useProjectStore((s) => s.project.glossary) ?? [];
  const mutate = useProjectStore((s) => s.mutate);
  const add = () => mutate((p) => { p.glossary = [...(p.glossary ?? []), { id: uid('gls'), term: 'Term', definition: '' }]; });
  const update = (id: string, patch: Partial<{ term: string; definition: string }>) =>
    mutate((p) => { const g = p.glossary?.find((x) => x.id === id); if (g) Object.assign(g, patch); });
  const remove = (id: string) => mutate((p) => { if (p.glossary) p.glossary = p.glossary.filter((x) => x.id !== id); });
  return (
    <>
      {glossary.map((g) => (
        <div key={g.id} className="mini-card">
          <Row>
            <Field label="Term"><TextInput value={g.term} onChange={(v) => update(g.id, { term: v })} /></Field>
            <button className="btn btn-ghost btn-icon btn-danger" title="Remove" onClick={() => remove(g.id)}>x</button>
          </Row>
          <Field label="Definition">
            <textarea className="input" rows={2} value={g.definition} onChange={(e) => update(g.id, { definition: e.target.value })} />
          </Field>
        </div>
      ))}
      <button className="btn" onClick={add}>+ Add term</button>
    </>
  );
}

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
      <CheckboxInput
        label="Closed captions (CC) button"
        checked={player.captionsButton ?? true}
        onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.captionsButton = v; })}
      />
      <p className="hint">Only appears on slides that actually have captions (Bake narration, or pasted into the slide's Captions field).</p>
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
      <Row>
        <Field label="Button hover effect">
          <SelectInput
            value={player.buttonHover ?? 'none'}
            options={[
              { value: 'none', label: 'None' },
              { value: 'lift', label: 'Lift' },
              { value: 'glow', label: 'Glow' },
              { value: 'scale', label: 'Scale' },
              { value: 'brightness', label: 'Brighten' }
            ]}
            onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.buttonHover = v === 'none' ? undefined : (v as 'lift'); })}
          />
        </Field>
        <Field label="Next/Submit emphasis">
          <SelectInput
            value={player.buttonEmphasis ?? 'none'}
            options={[
              { value: 'none', label: 'None' },
              { value: 'pulse', label: 'Pulse' },
              { value: 'glow', label: 'Glow' }
            ]}
            onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.buttonEmphasis = v === 'none' ? undefined : (v as 'pulse'); })}
          />
        </Field>
      </Row>
      <Field label="Nav buttons (Back/Next/Submit) position">
        <SelectInput
          value={player.navPosition ?? 'right'}
          options={[{ value: 'right', label: 'Bottom bar, right' }, { value: 'left', label: 'Bottom bar, left' }]}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.navPosition = v === 'right' ? undefined : 'left'; })}
        />
      </Field>
      <Field label="Course title">
        <SelectInput
          value={player.titlePosition ?? 'bottom'}
          options={[
            { value: 'bottom', label: 'Bottom bar' },
            { value: 'top', label: 'Title bar above the stage' },
            { value: 'hidden', label: 'Hidden' }
          ]}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.titlePosition = v === 'bottom' ? undefined : (v as 'top'); })}
        />
      </Field>
      <Field label="Button style">
        <SelectInput
          value={player.buttonStyle ?? 'solid'}
          options={[{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }]}
          onChange={(v) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); p.player.buttonStyle = v as 'solid'; })}
        />
      </Field>
      <p className="hint">Triggers can also enable/disable Next, Back, and Submit per slide (Enable/disable player button action).</p>
    </>
  );
}

function AlignControls() {
  const alignBlocks = useProjectStore((s) => s.alignBlocks);
  const distributeBlocks = useProjectStore((s) => s.distributeBlocks);
  const selection = useProjectStore((s) => s.selection);
  const multi = (selection.blockIds ?? []).length + (selection.blockId ? 1 : 0) >= 2;
  const [override, setOverride] = useState<'stage' | 'selection' | 'key' | null>(null);
  // Default: align to the stage when one block is selected, to each other
  // when several are. An explicit click on any chip overrides that.
  const target = override ?? (multi ? 'selection' : 'stage');
  const setTo = (t: 'stage' | 'selection' | 'key') => setOverride(t);
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
        <button
          className={`chip ${target === 'key' ? 'on' : ''}`}
          onClick={() => setTo('key')}
          disabled={!multi}
          title={multi ? 'Align every other selected block to the last one you clicked (it stays put)' : 'Shift-click 2+ blocks first'}
        >
          To key object
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
      <p className="hint">
        <strong>Shift-click</strong> two or more blocks on the stage, then use
        "To each other" (aligns to the group's bounds) or "To key object" -
        the last block you clicked (solid outline) stays put; the rest align
        to it.
      </p>
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
