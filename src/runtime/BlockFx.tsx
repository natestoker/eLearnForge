import { useEffect, useRef } from 'react';
import { runEmphasis } from '../blocks/emphasis';
import type { Emphasis } from '../blocks/emphasis';

// A stable inner layer for looping GSAP emphasis. Because React never sets a
// transform on this element, GSAP owns it outright - the timeline transform
// lives on the parent .player-block, so the two never overwrite each other.
export function BlockFx({ emphasis, children }: { emphasis?: Emphasis; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && emphasis && emphasis !== 'none') {
      return runEmphasis(ref.current, emphasis);
    }
  }, [emphasis]);
  return (
    <div ref={ref} className="block-fx" style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}

