import type { CSSProperties } from 'react';
import type { LabelStyle } from '../schema/types';

// One text style for the label of a widget (slider, checklist title, tab
// buttons...). Every field is optional: absent means "keep the block's
// default", so existing courses look exactly as before.
export function labelStyleCss(s?: LabelStyle): CSSProperties {
  if (!s) return {};
  const css: CSSProperties = {};
  if (s.fontFamily) css.fontFamily = `'${s.fontFamily}', sans-serif`;
  if (s.fontSize) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.italic) css.fontStyle = 'italic';
  if (s.color) css.color = s.color;
  return css;
}
