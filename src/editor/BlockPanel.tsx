import { useState } from 'react';
import { selectedIds, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { BLOCKS } from '../blocks/registry';
import { Field, NumberInput, Row, SelectInput, TextInput } from './fields';
import { EffectsPanel } from './EffectsPanel';
import { AnimatePanel } from './AnimatePanel';
import { BlockAudioSection } from './BlockAudioSection';

// The block editing home: a tabbed right-side panel restoring the original
// Properties / Effects / Animate split. The ribbon keeps quick actions; the
// deep editing (block options, shadow/reflection/states, entrance/exit
// stacks, motion paths, per-block audio) lives here where it has room.

type BlockTab = 'properties' | 'effects' | 'animate';

export function BlockPanel() {
  const [tab, setTab] = useState<BlockTab>('properties');
  return (
    <>
      <div className="tabs">
        {(['properties', 'effects', 'animate'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'properties' ? 'Properties' : t === 'effects' ? 'Effects' : 'Animate'}
          </button>
        ))}
      </div>
      {tab === 'effects' && <EffectsPanel />}
      {tab === 'animate' && <AnimatePanel />}
      {tab === 'properties' && <PropertiesTab />}
    </>
  );
}

function PropertiesTab() {
  const block = useSelectedBlock();
  const selection = useProjectStore((s) => s.selection);
  const updateBlock = useProjectStore((s) => s.updateBlock);

  if (selectedIds(selection).length >= 2) {
    return (
      <div className="panel-scroll">
        <p className="hint">Multiple blocks selected — size, align, and arrange them from the Format ribbon. Select a single block to edit its options here.</p>
      </div>
    );
  }
  if (!block) {
    return (
      <div className="panel-scroll">
        <p className="hint">Select a block on the canvas (or a bar in the timeline) to edit its name, position, and options here.</p>
      </div>
    );
  }

  const def = BLOCKS[block.type];
  return (
    <div className="panel-scroll">
      <div className="panel-title-row">
        <h3 className="panel-title">{def.label}</h3>
        <button
          className="btn btn-ghost btn-icon"
          style={block.locked ? { color: 'var(--danger)' } : undefined}
          title={block.locked ? 'Unlock (allow moving and editing on canvas)' : 'Lock (prevent canvas edits)'}
          onClick={() => updateBlock(block.id, (b) => { b.locked = b.locked ? undefined : true; })}
        >
          {block.locked ? '\u{1F512}' : '\u{1F513}'}
        </button>
      </div>

      <Field label="Name">
        <TextInput
          value={block.name ?? ''}
          placeholder={def.label}
          onChange={(v) => updateBlock(block.id, (b) => { b.name = v || undefined; })}
        />
      </Field>

      <Row>
        <Field label="X"><NumberInput value={Math.round(block.x)} onChange={(v) => updateBlock(block.id, (b) => { b.x = v; })} /></Field>
        <Field label="Y"><NumberInput value={Math.round(block.y)} onChange={(v) => updateBlock(block.id, (b) => { b.y = v; })} /></Field>
      </Row>
      <Row>
        <Field label="W"><NumberInput value={Math.round(block.w)} min={20} onChange={(v) => updateBlock(block.id, (b) => { b.w = Math.max(20, v); })} /></Field>
        <Field label="H"><NumberInput value={Math.round(block.h)} min={20} onChange={(v) => updateBlock(block.id, (b) => { b.h = Math.max(20, v); })} /></Field>
      </Row>
      <Row>
        <Field label="Rotation">
          <NumberInput
            value={block.rotation ?? 0} step={15}
            onChange={(v) => updateBlock(block.id, (b) => { b.rotation = v ? ((v % 360) + 360) % 360 : undefined; })}
          />
        </Field>
        <Field label="Screen reader">
          <SelectInput
            value={block.aria ?? 'auto'}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'include', label: 'Include' }, { value: 'exclude', label: 'Exclude' }]}
            onChange={(v) => updateBlock(block.id, (b) => { b.aria = v === 'auto' ? undefined : (v as 'include' | 'exclude'); })}
          />
        </Field>
      </Row>

      <div className="divider" />
      <h4 className="panel-subtitle">{def.label} options</h4>
      <def.Properties
        block={block}
        onUpdateProps={(fn, history = true) => updateBlock(block.id, (b) => fn(b.props), history)}
      />

      <div className="divider" />
      <h4 className="panel-subtitle">Audio</h4>
      <BlockAudioSection block={block} />
    </div>
  );
}
