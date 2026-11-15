import { RibbonEmpty } from './RibbonEmpty';
import { useState } from 'react';
import { selectedIds, useProjectStore, useSelectedBlock, walkBlocks } from '../../state/projectStore';
import { Field, NumberInput, Row, TextInput, SelectInput, ColorInput, RangeInput } from '../fields';
import { BLOCKS } from '../../blocks/registry';
import { Block, ShapeProps, TextProps } from '../../schema/types';
import { ShadowSection } from '../ShadowSection';

import { Lucide } from '../lucide';
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
    return <RibbonEmpty title="Select a block to arrange">Align, distribute, order, group and lock act on the selected blocks. Size and position are in the inspector on the right.</RibbonEmpty>;
  }

  const def = BLOCKS[block.type];

  return (
    <>
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
        </div>
        <span className="ribbon-group-title">Order</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <button
            className="btn"
            style={block.locked ? { color: 'var(--error)' } : undefined}
            onClick={() => updateBlock(block.id, (b) => { b.locked = b.locked ? undefined : true; })}
          >
            <Lucide name={block.locked ? 'lock' : 'lock-open'} size={14} /> {block.locked ? 'Locked' : 'Lock'}
          </button>
          <span className="rbn-note">Right-click a block for cut, copy, paste and delete</span>
        </div>
        <span className="ribbon-group-title">Block</span>
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
              <Lucide name={anyLocked ? 'lock-open' : 'lock'} size={14} /> {anyLocked ? 'Unlock all' : 'Lock all'}
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
        <button className="btn btn-icon" title="Align left edges" aria-label="Align left edges" onClick={() => alignBlocks('left', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 3v18" /><rect x="7" y="6" width="12" height="5" rx="1" /><rect x="7" y="13" width="7" height="5" rx="1" /></svg></button>
        <button className="btn btn-icon" title="Align centers horizontally" aria-label="Align centers horizontally" onClick={() => alignBlocks('hcenter', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18" /><rect x="5" y="6" width="14" height="5" rx="1" /><rect x="8" y="13" width="8" height="5" rx="1" /></svg></button>
        <button className="btn btn-icon" title="Align right edges" aria-label="Align right edges" onClick={() => alignBlocks('right', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M20 3v18" /><rect x="5" y="6" width="12" height="5" rx="1" /><rect x="10" y="13" width="7" height="5" rx="1" /></svg></button>
        <button className="btn btn-icon" title="Align top edges" aria-label="Align top edges" onClick={() => alignBlocks('top', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 4h18" /><rect x="6" y="7" width="5" height="12" rx="1" /><rect x="13" y="7" width="5" height="7" rx="1" /></svg></button>
        <button className="btn btn-icon" title="Align middles vertically" aria-label="Align middles vertically" onClick={() => alignBlocks('vcenter', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 12h18" /><rect x="6" y="5" width="5" height="14" rx="1" /><rect x="13" y="8" width="5" height="8" rx="1" /></svg></button>
        <button className="btn btn-icon" title="Align bottom edges" aria-label="Align bottom edges" onClick={() => alignBlocks('bottom', target)}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 20h18" /><rect x="6" y="5" width="5" height="12" rx="1" /><rect x="13" y="10" width="5" height="7" rx="1" /></svg></button>
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
