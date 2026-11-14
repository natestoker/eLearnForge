import { useCurrentSlide } from '../../state/projectStore';
import { RibbonEmpty } from './RibbonEmpty';

// The trigger list itself lives in the right-hand panel (see App.tsx) - it is
// far too tall for the ribbon strip. The shelf keeps a slim summary so the
// tab is not empty and orients the user toward the panel.
export function RibbonTriggers() {
  const slide = useCurrentSlide();
  const count = slide.triggers.length;
  return (
    <RibbonEmpty title={count === 0 ? 'No triggers on this slide yet' : `${count} trigger${count === 1 ? '' : 's'} on this slide`}>
      Add and edit triggers in the panel on the right {'→'}
    </RibbonEmpty>
  );
}
