import type { Block } from '../schema/types';
import { selectedIds, useProjectStore, useSelectedBlock } from '../state/projectStore';
import { blockDisplayName } from '../shared/blockName';
import { ShadowSection } from './ShadowSection';
import { ReflectionSection } from './ReflectionSection';
import { StatesSection } from './StatesSection';

// Graphic-effects tab: shadow, reflection, and interactive state styling for
// the selected block - pulled out of the (long) Properties panel so effects
// live together and are easy to find.

const SHADOWABLE = ['shape', 'button', 'image', 'text', 'group'];
const STATEFUL = ['shape', 'button', 'image', 'text', 'hotspot'];

export function EffectsPanel() {
  const block = useSelectedBlock();
  const selection = useProjectStore((s) => s.selection);
  const updateBlock = useProjectStore((s) => s.updateBlock);

  if (selectedIds(selection).length >= 2) {
    return (
      <div className="panel-scroll">
        <p className="hint">Select a single block to edit its shadow, reflection, and states. (Shadow for the whole selection is on the Properties tab.)</p>
      </div>
    );
  }
  if (!block) {
    return (
      <div className="panel-scroll">
        <p className="hint">Select a block to add a shadow, a reflection, or interactive state styling.</p>
      </div>
    );
  }

  const update = (fn: (b: Block) => void) => updateBlock(block.id, (b) => fn(b));

  return (
    <div className="panel-scroll">
      <h3 className="panel-title">Effects — {blockDisplayName(block)}</h3>

      {SHADOWABLE.includes(block.type) && (
        <>
          <h4 className="panel-subtitle">Shadow</h4>
          <ShadowSection block={block} onUpdate={update} />
          <div className="divider" />
        </>
      )}

      <h4 className="panel-subtitle">Reflection</h4>
      <ReflectionSection block={block} onUpdate={update} />

      {STATEFUL.includes(block.type) && (
        <>
          <div className="divider" />
          <h4 className="panel-subtitle">States</h4>
          <StatesSection block={block} onUpdate={update} />
        </>
      )}
    </div>
  );
}
