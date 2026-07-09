import { useSelectedBlock } from '../../state/projectStore';
import { AnimatePanel } from '../AnimatePanel';
import { EffectsPanel } from '../EffectsPanel';

export function RibbonAnimations() {
  const block = useSelectedBlock();

  if (!block) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Select a block to animate.</div>;
  }

  // To save time, we will simply render the existing panels but side-by-side in ribbon groups
  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
          <EffectsPanel />
        </div>
        <span className="ribbon-group-title">Effects</span>
      </div>
      <div className="ribbon-group">
        <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
          <AnimatePanel />
        </div>
        <span className="ribbon-group-title">Animations</span>
      </div>
    </>
  );
}
