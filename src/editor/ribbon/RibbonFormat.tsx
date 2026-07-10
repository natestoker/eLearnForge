import { useState } from 'react';
import { selectedIds, useProjectStore, useSelectedBlock, walkBlocks } from '../../state/projectStore';
import { Field, NumberInput, Row, TextInput, SelectInput, ColorInput, RangeInput } from '../fields';
import { BLOCKS } from '../../blocks/registry';
import { Block, ShapeProps, TextProps } from '../../schema/types';
import { ShadowSection } from '../ShadowSection';

export function RibbonFormat() {
  const block = useSelectedBlock();
  const selection = useProjectStore((s) => s.selection);
  const slide = useProjectStore((s) => s.project.slides.find(sl => sl.id === s.selection.slideId));
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const moveBlockZ = useProjectStore((s) => s.moveBlockZ);
  const deleteBlock = useProjectStore((s) => s.deleteBlock);

  const multiIds = selectedIds(selection);

  if (multiIds.length >= 2) {
    return <MultiRibbonFormat ids={multiIds} />;
  }

  if (!block) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Select a block to format.</div>;
  }

  const def = BLOCKS[block.type];

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <Field label="Name">
            <TextInput
              value={block.name ?? ''} placeholder={def.label}
              onChange={(v) => updateBlock(block.id, (b) => { b.name = v || undefined; })}
            />
          </Field>
          <Field label="Aria">
            <SelectInput
              value={block.aria ?? 'auto'}
              options={[{ value: 'auto', label: 'Auto' }, { value: 'include', label: 'Include' }, { value: 'exclude', label: 'Exclude' }]}
              onChange={(v) => updateBlock(block.id, (b) => { b.aria = v === 'auto' ? undefined : (v as 'include' | 'exclude'); })}
            />
          </Field>
        </div>
        <span className="ribbon-group-title">Identification</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="X"><NumberInput value={Math.round(block.x)} onChange={(v) => updateBlock(block.id, (b) => { b.x = v; })} /></Field>
            <Field label="Y"><NumberInput value={Math.round(block.y)} onChange={(v) => updateBlock(block.id, (b) => { b.y = v; })} /></Field>
            <Field label="W"><NumberInput value={Math.round(block.w)} min={40} onChange={(v) => updateBlock(block.id, (b) => { b.w = v; })} /></Field>
            <Field label="H"><NumberInput value={Math.round(block.h)} min={40} onChange={(v) => updateBlock(block.id, (b) => { b.h = v; })} /></Field>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 8 }}>
            <Field label="Rotation">
              <NumberInput
                value={block.rotation ?? 0} step={15}
                onChange={(v) => updateBlock(block.id, (b) => { b.rotation = v ? ((v % 360) + 360) % 360 : undefined; })}
              />
            </Field>
            <button
              className="btn"
              style={block.locked ? { color: 'var(--danger)' } : undefined}
              onClick={() => updateBlock(block.id, (b) => { b.locked = b.locked ? undefined : true; })}
            >
              {block.locked ? '\u{1F512} Locked' : '\u{1F513} Unlocked'}
            </button>
          </div>
        </div>
        <span className="ribbon-group-title">Size & Position</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <def.Properties
              block={block}
              onUpdateProps={(fn, history = true) => updateBlock(block.id, (b) => fn(b.props), history)}
            />
          </div>
        </div>
        <span className="ribbon-group-title">{def.label} Properties</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <AlignControls />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
            <GroupControls />
          </div>
        </div>
        <span className="ribbon-group-title">Align & Group</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => moveBlockZ(block.id, 'back')}>To back</button>
            <button className="btn" onClick={() => moveBlockZ(block.id, 'backward')}>Back</button>
            <button className="btn" onClick={() => moveBlockZ(block.id, 'forward')}>Fwd</button>
            <button className="btn" onClick={() => moveBlockZ(block.id, 'front')}>To front</button>
          </div>
          <ClipboardControls />
          <button className="btn btn-danger-solid" onClick={() => deleteBlock(block.id)}>Delete block</button>
        </div>
        <span className="ribbon-group-title">Arrange</span>
      </div>
    </>
  );
}

function MultiRibbonFormat({ ids }: { ids: string[] }) {
  const slide = useProjectStore((s) => s.project.slides.find(sl => sl.id === s.selection.slideId));
  const mutate = useProjectStore((s) => s.mutate);
  const select = useProjectStore((s) => s.select);
  const updateBlock = useProjectStore((s) => s.updateBlock);

  if (!slide) return null;
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

  const anyLocked = blocks.some((b) => b.locked);

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="W"><NumberInput value={Math.round(first.w)} min={20} onChange={(v) => each((b) => { b.w = Math.max(20, v); })} /></Field>
            <Field label="H"><NumberInput value={Math.round(first.h)} min={20} onChange={(v) => each((b) => { b.h = Math.max(20, v); })} /></Field>
            <Field label="Rotation">
              <NumberInput value={first.rotation ?? 0} step={15} onChange={(v) => each((b) => { b.rotation = v ? ((v % 360) + 360) % 360 : undefined; })} />
            </Field>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 8 }}>
            <button className="btn" style={anyLocked ? { color: 'var(--danger)' } : undefined} onClick={() => each((b) => { b.locked = anyLocked ? undefined : true; })}>
              {anyLocked ? '\u{1F513} Unlock all' : '\u{1F512} Lock all'}
            </button>
          </div>
        </div>
        <span className="ribbon-group-title">{blocks.length} Blocks Size</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <AlignControls />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
            <GroupControls />
          </div>
        </div>
        <span className="ribbon-group-title">Align & Group</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <ClipboardControls />
          <button className="btn btn-danger-solid" onClick={() => {
            mutate((p) => {
              const s = p.slides.find((sl) => sl.id === slide.id);
              if (!s) return;
              const idSet = new Set(ids);
              for (const l of s.layers) {
                l.blocks = l.blocks.filter((b) => !idSet.has(b.id));
              }
            });
            select({ blockId: null, blockIds: [] });
          }}>Delete {blocks.length} blocks</button>
        </div>
        <span className="ribbon-group-title">Arrange</span>
      </div>
    </>
  );
}

function AlignControls() {
  const alignBlocks = useProjectStore((s) => s.alignBlocks);
  const distributeBlocks = useProjectStore((s) => s.distributeBlocks);
  const selection = useProjectStore((s) => s.selection);
  const multi = (selection.blockIds ?? []).length + (selection.blockId ? 1 : 0) >= 2;
  const [override, setOverride] = useState<'stage' | 'selection' | 'key' | null>(null);
  const target = override ?? (multi ? 'selection' : 'stage');
  const setTo = (t: 'stage' | 'selection' | 'key') => setOverride(t);
  return (
    <div className="align-controls">
      <div className="align-target">
        <button className={`chip ${target === 'stage' ? 'on' : ''}`} onClick={() => setTo('stage')}>To stage</button>
        <button className={`chip ${target === 'selection' ? 'on' : ''}`} onClick={() => setTo('selection')} disabled={!multi}>To each other</button>
        <button className={`chip ${target === 'key' ? 'on' : ''}`} onClick={() => setTo('key')} disabled={!multi}>To key object</button>
      </div>
      <div className="align-grid">
        <button className="btn btn-icon" onClick={() => alignBlocks('left', target)}>{'\u2596'}</button>
        <button className="btn btn-icon" onClick={() => alignBlocks('hcenter', target)}>{'\u2503'}</button>
        <button className="btn btn-icon" onClick={() => alignBlocks('right', target)}>{'\u2597'}</button>
        <button className="btn btn-icon" onClick={() => alignBlocks('top', target)}>{'\u2594'}</button>
        <button className="btn btn-icon" onClick={() => alignBlocks('vcenter', target)}>{'\u2501'}</button>
        <button className="btn btn-icon" onClick={() => alignBlocks('bottom', target)}>{'\u2581'}</button>
      </div>
      <div className="field-row">
        <button className="btn" onClick={() => distributeBlocks('h')} disabled={!multi}>Distribute H</button>
        <button className="btn" onClick={() => distributeBlocks('v')} disabled={!multi}>Distribute V</button>
      </div>
    </div>
  );
}

function ClipboardControls() {
  const copyBlocks = useProjectStore((s) => s.copyBlocks);
  const cutBlocks = useProjectStore((s) => s.cutBlocks);
  const pasteBlocks = useProjectStore((s) => s.pasteBlocks);
  return (
    <div className="z-order-row">
      <button className="btn" onClick={copyBlocks}>Copy</button>
      <button className="btn" onClick={cutBlocks}>Cut</button>
      <button className="btn" onClick={pasteBlocks}>Paste here</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button className="btn" onClick={groupBlocks} disabled={!canGroup}>Group</button>
      <button className="btn" onClick={ungroupBlocks} disabled={!anyGrouped}>Ungroup</button>
    </div>
  );
}
