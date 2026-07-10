import { useCurrentSlide } from '../../state/projectStore';

// The trigger list itself lives in the right-hand panel (see App.tsx) - it is
// far too tall for the ribbon strip. The shelf keeps a slim summary so the
// tab is not empty and orients the user toward the panel.
export function RibbonTriggers() {
  const slide = useCurrentSlide();
  const count = slide.triggers.length;

  return (
    <div className="ribbon-group">
      <div className="ribbon-items" style={{ alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {count === 0 ? 'No triggers on this slide yet.' : `${count} trigger${count === 1 ? '' : 's'} on this slide.`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Add and edit triggers in the panel on the right {'→'}
        </span>
      </div>
      <span className="ribbon-group-title">Slide Triggers</span>
    </div>
  );
}
