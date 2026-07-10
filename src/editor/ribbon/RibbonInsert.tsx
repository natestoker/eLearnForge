import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { Block, BlockType, ShapeKind, ShapeProps } from '../../schema/types';
import { ShapePicker } from '../../blocks/shape/ShapePicker';
import { ShapeSvg } from '../../blocks/shape/Canvas';
import { SHAPE_LABELS } from '../../blocks/shape/geometry';

// Insert shelf, laid out per the design artifact: horizontal groups with a
// compact icon+label button per insertable. The shape grid shows the core
// presets two rows deep; the full picker lives behind "All shapes".

const CORE_SHAPES: ShapeKind[] = [
  'rectangle', 'roundedRectangle', 'ellipse', 'triangle',
  'diamond', 'pentagon', 'hexagon', 'star',
  'arrowRight', 'arrowLeft', 'chevron', 'parallelogram',
  'plus', 'heart', 'lightningBolt', 'cloud'
];

function Ic({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, JSX.Element> = {
  text: <Ic d="M5 7V5.5h14V7M12 5.5v13M9 18.5h6" />,
  textEntry: <Ic d="M4.5 8.5h15a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM7 11v2" />,
  image: <Ic d="M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8.5 10.5a.6.6 0 1 0 0-.1M5 16l4.5-4.5 3.5 3.5 3-3 4 4" />,
  video: <Ic d="M4.5 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM16.5 11l4-2.5v7l-4-2.5z" />,
  audio: <Ic d="M10 4.5h4v9.5a2.5 2.5 0 1 1-1.5-2.3V4.5" />,
  button: <Ic d="M5 9h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 15H5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 5 9zM9 12h6" />,
  hotspot: <Ic d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" />,
  multipleChoice: <Ic d="M6.5 5.7a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM11.5 7.5h8M6.5 14.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM11.5 16.2h8" />,
  matching: <Ic d="M4 6.5h5v4H4zM15 13.5h5v4H15zM9.5 8.5h6l-6 7.5h-4" />,
  fillBlank: <Ic d="M4 17.5h16M4 8h4.5M12.5 8H20M9.5 6.5h2.5v3.5H9.5z" />,
  dragDrop: <Ic d="M4.5 4.5h6.5v6.5H4.5zM13 13h6.5v6.5H13zM11 11l3.5 3.5M14.5 11.4V15h-3.6" />,
  tabs: <Ic d="M4 8.5h16v9H4zM4 8.5V6h6v2.5M12 6v2.5" />,
  statement: <Ic d="M5 5.5h14v9H9l-4 4z" />,
  progress: <Ic d="M4 10.5h16v3H4zM13 10.5v3" />,
  timer: <Ic d="M12 8v4.5l3 2M12 5.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 3.5h4" />,
  code: <Ic d="M9 8l-4 4 4 4M15 8l4 4-4 4" />,
  line: <Ic d="M4 18L20 6" />,
  arrow: <Ic d="M4 18L18 7M18 12V7h-5" />,
  pen: <Ic d="M14.5 5.5l4 4L8 20l-4.8 1 1-4.8zM12.5 7.5l4 4" />,
  flashcards: <Ic d="M7 7.5h13v11H7zM7 7.5L4 6v11l3 1.5M11 12.5h5" />,
  sequence: <Ic d="M5 6.5h2M10 6.5h9M5 12h2M10 12h9M5 17.5h2M10 17.5h9" />,
  slider: <Ic d="M4 12h16M9.5 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM4 8.5v7M20 8.5v7" />,
  checklist: <Ic d="M4.5 6.5l1.5 1.5 2.5-2.5M10.5 7h9M4.5 13l1.5 1.5 2.5-2.5M10.5 13.5h9M4.5 19.5l1.5 1.5 2.5-2.5M10.5 20h9" />
};

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
  const [allShapesOpen, setAllShapesOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allShapesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setAllShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAllShapesOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [allShapesOpen]);

  const pickShape = (kind: ShapeKind) => {
    addBlock('shape', (b) => { (b.props as ShapeProps).kind = kind; });
    setAllShapesOpen(false);
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
              <button className="rbn-mbtn" aria-haspopup="menu" aria-expanded={allShapesOpen} onClick={() => setAllShapesOpen((o) => !o)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
                </svg>
                <span>All shapes {'▾'}</span>
              </button>
              {allShapesOpen && (
                <div className="menu rbn-shapes-menu" role="menu">
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
          <div className="rbn-grid2">
            <MBtn icon="button" label="Button" onClick={() => addBlock('button')} />
            <MBtn icon="hotspot" label="Hotspot" onClick={() => addBlock('hotspot')} />
            <MBtn icon="multipleChoice" label="Quiz" onClick={() => addBlock('multipleChoice')} />
            <MBtn icon="matching" label="Match" onClick={() => addBlock('matching')} />
            <MBtn icon="fillBlank" label="Fill Blank" onClick={() => addBlock('fillBlank')} />
            <MBtn icon="dragDrop" label="Drag & Drop" onClick={() => addBlock('dragDrop')} />
            <MBtn icon="flashcards" label="Flashcards" onClick={() => addBlock('flashcards')} />
            <MBtn icon="sequence" label="Sequence" onClick={() => addBlock('sequence')} />
          </div>
        </div>
        <span className="ribbon-group-title">Interactive</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div className="rbn-grid2">
            <MBtn icon="tabs" label="Tabs" onClick={() => addBlock('tabs')} />
            <MBtn icon="statement" label="Statement" onClick={() => addBlock('statement')} />
            <MBtn icon="progress" label="Progress" onClick={() => addBlock('progress')} />
            <MBtn icon="timer" label="Timer" onClick={() => addBlock('timer')} />
            <MBtn icon="code" label="Code" onClick={() => addBlock('code')} />
            <MBtn icon="slider" label="Slider" onClick={() => addBlock('slider')} />
            <MBtn icon="checklist" label="Checklist" onClick={() => addBlock('checklist')} />
          </div>
        </div>
        <span className="ribbon-group-title">Widgets</span>
      </div>
    </>
  );
}
