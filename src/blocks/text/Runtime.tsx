import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { textStyle } from './Canvas';
import { buildUnits, applyTextAnim, type TextUnit } from './textAnim';

export function TextRuntime({ block, runtime, t }: RuntimeRendererProps) {
  const props = block.props as TextProps;
  const ref = useRef<HTMLDivElement>(null);
  const unitsRef = useRef<TextUnit[] | null>(null);
  const anim = props.textAnim ?? 'none';
  const animated = anim !== 'none';

  // Storyline-style references: %VariableName% and built-ins like
  // %SlideNumber% resolve to live values. The Player re-renders on every
  // runtime change, so the text stays current as variables move.
  const html = runtime ? runtime.substituteReferences(props.html) : props.html;

  // Own the innerHTML imperatively so React's reconciler never wipes the
  // per-unit spans we inject for the animation. Rebuild whenever the content
  // or animation changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    unitsRef.current = animated ? buildUnits(el, anim) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, anim]);

  // Recompute animation state on every t change. Stateless: progress is a
  // pure function of t, so scrubbing the seekbar reverses it.
  useEffect(() => {
    if (!ref.current || !animated) return;
    const start = block.timing?.start ?? 0;
    const win = 0.8;
    let p = 1;
    if (t === undefined) p = 1;
    else if (t < start) p = 0;
    else p = Math.min(1, (t - start) / win);
    applyTextAnim(ref.current, anim, p, unitsRef.current);
  }, [t, anim, animated, block.timing?.start]);

  return <div ref={ref} className="text-block" style={textStyle(props)} />;
}
