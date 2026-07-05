import type { ShapeKind } from '../../schema/types';

// Preset geometry in a 100x100 viewBox, stretched non-uniformly to the
// block bounds (preserveAspectRatio none) - the PowerPoint model. Points
// are polygons; rectangle/rounded/ellipse render as native SVG elements.

export const SHAPE_POINTS: Partial<Record<ShapeKind, string>> = {
  triangle: '50,0 100,100 0,100',
  rightTriangle: '0,0 100,100 0,100',
  diamond: '50,0 100,50 50,100 0,50',
  pentagon: '50,0 100,38 81,100 19,100 0,38',
  hexagon: '25,0 75,0 100,50 75,100 25,100 0,50',
  star: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35',
  arrowRight: '0,30 60,30 60,10 100,50 60,90 60,70 0,70',
  arrowLeft: '100,30 40,30 40,10 0,50 40,90 40,70 100,70',
  arrowUp: '30,100 30,40 10,40 50,0 90,40 70,40 70,100',
  arrowDown: '30,0 30,60 10,60 50,100 90,60 70,60 70,0',
  chevron: '0,0 75,0 100,50 75,100 0,100 25,50',
  parallelogram: '25,0 100,0 75,100 0,100',
  trapezoid: '20,0 80,0 100,100 0,100'
};

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: 'Rectangle',
  roundedRectangle: 'Rounded rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  rightTriangle: 'Right triangle',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star',
  arrowRight: 'Arrow right',
  arrowLeft: 'Arrow left',
  arrowUp: 'Arrow up',
  arrowDown: 'Arrow down',
  chevron: 'Chevron',
  parallelogram: 'Parallelogram',
  trapezoid: 'Trapezoid'
};

// PowerPoint prstGeom names -> our kinds (import mapping).
export const PRSTGEOM_TO_KIND: Record<string, ShapeKind> = {
  rect: 'rectangle',
  roundRect: 'roundedRectangle',
  ellipse: 'ellipse',
  triangle: 'triangle',
  rtTriangle: 'rightTriangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  star5: 'star',
  rightArrow: 'arrowRight',
  leftArrow: 'arrowLeft',
  upArrow: 'arrowUp',
  downArrow: 'arrowDown',
  chevron: 'chevron',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid'
};

// A CSS clip-path polygon (percentages) for a preset shape kind. Used to clip
// image blocks to a shape. Rectangles/rounded/ellipse are handled separately
// by the caller (ellipse -> circle()/ellipse(), rect -> none/inset).
export function clipPathForKind(kind: ShapeKind): string | null {
  if (kind === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (kind === 'rectangle' || kind === 'roundedRectangle') return null;
  const pts = SHAPE_POINTS[kind];
  if (!pts) return null;
  return pointsToClipPath(pts);
}

// Convert "x,y x,y ..." (0..100 space) into a CSS polygon() clip-path.
export function pointsToClipPath(points: string): string {
  const coords = points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return `${x}% ${y}%`;
    })
    .join(', ');
  return `polygon(${coords})`;
}
