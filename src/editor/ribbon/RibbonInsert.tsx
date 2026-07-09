import { useProjectStore } from '../../state/projectStore';
import { useUiStore } from '../../state/uiStore';
import { Block, BlockType, ShapeProps } from '../../schema/types';
import { BLOCKS } from '../../blocks/registry';
import { ShapePicker } from '../../blocks/shape/ShapePicker';

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

export function RibbonInsert() {
  const addBlock = useProjectStore((s) => s.addBlock);

  return (
    <>
      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn btn-ghost" onClick={() => addBlock('text')}><span className="menu-glyph">{BLOCKS['text'].glyph}</span> Text</button>
            <button className="btn btn-ghost" onClick={() => addBlock('textEntry')}><span className="menu-glyph">{BLOCKS['textEntry'].glyph}</span> Text Entry</button>
          </div>
        </div>
        <span className="ribbon-group-title">Text</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items" style={{ alignItems: 'flex-start' }}>
          <ShapePicker
            onPick={(kind) => addBlock('shape', (b) => { (b.props as ShapeProps).kind = kind; })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
            <button className="btn btn-ghost" onClick={() => insertLine(addBlock, false)}><span className="menu-glyph">{'—'}</span> Line</button>
            <button className="btn btn-ghost" onClick={() => insertLine(addBlock, true)}><span className="menu-glyph">{'→'}</span> Arrow</button>
            <button className="btn btn-ghost" onClick={() => {
              addBlock('shape', (b) => { b.w = 300; b.h = 300; });
              const id = useProjectStore.getState().selection.blockId;
              if (id) useUiStore.getState().openPenEditor(id, 'shape');
            }}><span className="menu-glyph">{'✎'}</span> Custom shape</button>
          </div>
        </div>
        <span className="ribbon-group-title">Shapes</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn btn-ghost" onClick={() => addBlock('image')}><span className="menu-glyph">{BLOCKS['image'].glyph}</span> Image</button>
            <button className="btn btn-ghost" onClick={() => addBlock('video')}><span className="menu-glyph">{BLOCKS['video'].glyph}</span> Video</button>
            <button className="btn btn-ghost" onClick={() => addBlock('audio')}><span className="menu-glyph">{BLOCKS['audio'].glyph}</span> Audio</button>
          </div>
        </div>
        <span className="ribbon-group-title">Media</span>
      </div>

      <div className="ribbon-group">
        <div className="ribbon-items">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <button className="btn btn-ghost" onClick={() => addBlock('button')}><span className="menu-glyph">{BLOCKS['button'].glyph}</span> Button</button>
            <button className="btn btn-ghost" onClick={() => addBlock('hotspot')}><span className="menu-glyph">{BLOCKS['hotspot'].glyph}</span> Hotspot</button>
            <button className="btn btn-ghost" onClick={() => addBlock('multipleChoice')}><span className="menu-glyph">{BLOCKS['multipleChoice'].glyph}</span> Quiz</button>
            <button className="btn btn-ghost" onClick={() => addBlock('matching')}><span className="menu-glyph">{BLOCKS['matching'].glyph}</span> Match</button>
            <button className="btn btn-ghost" onClick={() => addBlock('fillBlank')}><span className="menu-glyph">{BLOCKS['fillBlank'].glyph}</span> Fill Blank</button>
            <button className="btn btn-ghost" onClick={() => addBlock('dragDrop')}><span className="menu-glyph">{BLOCKS['dragDrop'].glyph}</span> DragDrop</button>
          </div>
        </div>
        <span className="ribbon-group-title">Interactive</span>
      </div>
    </>
  );
}
