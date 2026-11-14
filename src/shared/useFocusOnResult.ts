import { useEffect, useRef } from 'react';

// After a learner submits an answer the button they pressed often disappears
// (Submit becomes feedback), which drops keyboard focus back to the page and
// leaves a screen-reader user without a position. This returns a ref to put on
// the feedback element (give it tabIndex={-1}); focus moves there whenever a
// result appears, so the feedback is read out and Tab continues from it.
export function useFocusOnResult<T extends HTMLElement>(hasResult: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (hasResult) ref.current?.focus({ preventScroll: true });
  }, [hasResult]);
  return ref;
}
