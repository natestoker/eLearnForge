import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { Block, BlockType, ShapeKind, ShapeProps } from '../../schema/types';
import { ShapePicker } from '../../blocks/shape/ShapePicker';
import { ShapeSvg } from '../../blocks/shape/Canvas';
import { SHAPE_LABELS } from '../../blocks/shape/geometry';
import { Lucide } from '../lucide';

// Insert shelf, laid out per the design artifact: horizontal groups with a
// compact icon+label button per insertable. The shape grid shows the core
// presets two rows deep; the full picker lives behind "All shapes".

const CORE_SHAPES: ShapeKind[] = [
  'rectangle', 'roundedRectangle', 'ellipse', 'triangle',
  'diamond', 'pentagon', 'hexagon', 'star',
  'arrowRight', 'arrowLeft', 'chevron', 'parallelogram',
  'plus', 'heart', 'lightningBolt', 'cloud'
];

const ICON_NAMES: Record<string, string> = {
  text: 'type',
  textEntry: 'text-cursor-input',
  image: 'image',
  video: 'video',
  audio: 'audio-lines',
  button: 'rectangle-horizontal',
  hotspot: 'mouse-pointer-click',
  multipleChoice: 'circle-dot',
  matching: 'arrow-left-right',
  fillBlank: 'text-cursor',
  dragDrop: 'move',
  tabs: 'panels-top-left',
  statement: 'message-square',
  progress: 'gauge',
  timer: 'timer',
  code: 'code',
  line: 'minus',
  arrow: 'arrow-up-right',
  pen: 'pen-tool',
  flashcards: 'layers',
  sequence: 'list-ordered',
  slider: 'sliders-horizontal',
  checklist: 'list-checks',
  results: 'chart-column',
  varDisplay: 'hash',
  labeledGraphic: 'map-pin',
  scenario: 'git-fork'
};

// One icon family (Lucide) across the editor.
const ICONS = new Proxy({} as Record<string, JSX.Element>, {
  get: (_t, key: string) => <Lucide name={ICON_NAMES[key] ?? 'box'} size={18} />
});

function insertLine(addBlock: (type: BlockType, init?: (b: Block) => void) => void, withArrow: boolean) {
  addBlock('shape', (b) => {
    const p = b.props as ShapeProps;
    p.isLine = true;
    p.points = '0,50 100,50';
    p.fill = 'transparent';
    p.borderWidth = 3;
    if (withArrow) p.lineEnd = { type: 'triangle', size: 'md' };
    b.w = 260;
    b.h = 40;
  });
}

function MBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="rbn-mbtn" onClick={onClick}>
      {ICONS[icon]}
      <span>{label}</span>
    </button>
  );
}

export function RibbonInsert() {
  const addBlock = useProjectStore((s) => s.addBlock);
  // The shelf clips overflow (overflow-x: auto), so the popover renders with
  // position: fixed at the button's screen position instead of absolute.
  const [allShapesOpen, setAllShapesOpen] = useState<{ left: number; top: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allShapesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setAllShapesOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAllShapesOpen(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [allShapesOpen]);

  const pickShape = (kind: ShapeKind) => {
    addBlock('shape', (b) => { (b.props as ShapeProps).kind = kind; });
    setAllShapesOpen(null);
  };

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-col">
            <MBtn icon="text" label="Text" onClick={() => addBlock('text')} />
            <MBtn icon="textEntry" label="Text Entry" onClick={() => addBlock('textEntry')} />
          </div>
        </div>
        <span className="ribbon-group-title">Text</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ alignItems: 'flex-start', gap: 10 }}>
          <div className="rbn-shape-grid">
            {CORE_SHAPES.map((kind) => (
              <button
                key={kind}
                className="rbn-shape-tile"
                title={SHAPE_LABELS[kind]}
                aria-label={SHAPE_LABELS[kind]}
                onClick={() => pickShape(kind)}
              >
                <ShapeSvg props={{ kind, fill: 'currentColor', borderColor: 'transparent', borderWidth: 0, cornerRadius: 2 }} />
              </button>
            ))}
          </div>
          <div className="rbn-col">
            <MBtn icon="line" label="Line" onClick={() => insertLine(addBlock, false)} />
            <MBtn icon="arrow" label="Arrow" onClick={() => insertLine(addBlock, true)} />
            <MBtn
              icon="pen"
              label="Custom"
              onClick={() => {
                addBlock('shape', (b) => { b.w = 300; b.h = 300; });
                const id = useProjectStore.getState().selection.blockId;
                if (id) useUiStore.getState().openPenEditor(id, 'shape');
              }}
            />
            <div className="menu-anchor" ref={popRef}>
              <button
                className="rbn-mbtn"
                aria-haspopup="menu"
                aria-expanded={!!allShapesOpen}
                onClick={(e) => {
                  if (allShapesOpen) { setAllShapesOpen(null); return; }
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setAllShapesOpen({ left: Math.round(r.left), top: Math.round(r.bottom + 4) });
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
                </svg>
                <span>All shapes {'▾'}</span>
              </button>
              {allShapesOpen && (
                <div
                  className="menu rbn-shapes-menu"
                  role="menu"
                  style={{ position: 'fixed', left: allShapesOpen.left, top: allShapesOpen.top }}
                >
                  <ShapePicker onPick={pickShape} />
                </div>
              )}
            </div>
          </div>
        </div>
        <span className="ribbon-group-title">Shapes</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-col">
            <MBtn icon="image" label="Image" onClick={() => addBlock('image')} />
            <MBtn icon="video" label="Video" onClick={() => addBlock('video')} />
            <MBtn icon="audio" label="Audio" onClick={() => addBlock('audio')} />
          </div>
        </div>
        <span className="ribbon-group-title">Media</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-grid3">
            <MBtn icon="button" label="Button" onClick={() => addBlock('button')} />
            <MBtn icon="hotspot" label="Hotspot" onClick={() => addBlock('hotspot')} />
            <MBtn icon="multipleChoice" label="Quiz" onClick={() => addBlock('multipleChoice')} />
            <MBtn icon="matching" label="Match" onClick={() => addBlock('matching')} />
            <MBtn icon="fillBlank" label="Fill Blank" onClick={() => addBlock('fillBlank')} />
            <MBtn icon="dragDrop" label="Drag & Drop" onClick={() => addBlock('dragDrop')} />
            <MBtn icon="flashcards" label="Flashcards" onClick={() => addBlock('flashcards')} />
            <MBtn icon="sequence" label="Sequence" onClick={() => addBlock('sequence')} />
            <MBtn icon="labeledGraphic" label="Labeled Graphic" onClick={() => addBlock('labeledGraphic')} />
            <MBtn icon="scenario" label="Scenario" onClick={() => addBlock('scenario')} />
          </div>
        </div>
        <span className="ribbon-group-title">Interactive</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-grid3">
            <MBtn icon="tabs" label="Tabs" onClick={() => addBlock('tabs')} />
            <MBtn icon="statement" label="Statement" onClick={() => addBlock('statement')} />
            <MBtn icon="progress" label="Progress" onClick={() => addBlock('progress')} />
            <MBtn icon="timer" label="Timer" onClick={() => addBlock('timer')} />
            <MBtn icon="code" label="Code" onClick={() => addBlock('code')} />
            <MBtn icon="slider" label="Slider" onClick={() => addBlock('slider')} />
            <MBtn icon="checklist" label="Checklist" onClick={() => addBlock('checklist')} />
            <MBtn icon="varDisplay" label="Score" onClick={() => addBlock('varDisplay')} />
            <MBtn icon="results" label="Results" onClick={() => addBlock('results')} />
          </div>
        </div>
        <span className="ribbon-group-title">Widgets</span>
      </div>
    </>
  );
}
