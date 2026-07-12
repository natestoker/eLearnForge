import type { CSSProperties } from 'react';
import type { SlideBackground } from '../schema/types';

// Turn a slide's background spec into inline styles, shared by the editor
// stage and the runtime player so the two always match. Absent = no styles
// (the theme surface shows through).
export function slideBackgroundStyle(bg?: SlideBackground): CSSProperties {
  if (!bg) return {};
  switch (bg.type) {
    case 'color':
      return { background: bg.color || '#ffffff' };
    case 'gradient':
      return { background: `linear-gradient(${bg.angle ?? 135}deg, ${bg.from || '#3ddc97'}, ${bg.to || '#0b1f17'})` };
    case 'image':
      if (!bg.src) return {};
      return bg.fit === 'tile'
        ? { backgroundImage: `url("${bg.src}")`, backgroundRepeat: 'repeat' }
        : { backgroundImage: `url("${bg.src}")`, backgroundSize: bg.fit ?? 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
    default:
      return {};
  }
}
