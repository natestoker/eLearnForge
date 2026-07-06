import type { ShapeKind, ShapeProps } from '../../schema/types';
import { SHAPE_LABELS } from './geometry';
import { ShapeSvg } from './Canvas';

// The one visual shape picker, shared by the Insert menu and the shape
// property panel. Tiles render the real preset geometry through ShapeSvg,
// so the picker can never drift from what the canvas draws.

const KINDS = Object.keys(SHAPE_LABELS) as ShapeKind[];

function thumbProps(kind: ShapeKind): ShapeProps {
  return { kind, fill: 'currentColor', borderColor: 'transparent', borderWidth: 0, cornerRadius: 3 };
}

export function ShapePicker({ value, onPick }: {
  value?: ShapeKind | null; // highlighted kind; null/undefined = none
  onPick: (kind: ShapeKind) => void;
}) {
  return (
    <div className="shape-grid">
      {KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          className={`shape-tile ${value === kind ? 'on' : ''}`}
          title={SHAPE_LABELS[kind]}
          aria-label={SHAPE_LABELS[kind]}
          onClick={() => onPick(kind)}
        >
          <span className="shape-glyph"><ShapeSvg props={thumbProps(kind)} /></span>
        </button>
      ))}
    </div>
  );
}
