import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { BLOCKS } from '../blocks/registry';
import type { Block, BlockType, ShapeProps } from '../schema/types';
import { ShapePicker } from '../blocks/shape/ShapePicker';
import { exportProjectJson, exportProjectJsonAs, importProjectJson, importProjectJsonWithPicker, resetFileHandle } from '../state/persistence';
import { createDemoProject, createProject } from '../schema/factory';
import { PublishDialog } from './PublishDialog';
import { importPptx } from '../publish/pptxImport';

// Toolbar layout principle: the bar itself holds only the always-on editing
// actions (Insert, Undo/Redo); everything project-level lives in two menus -
// File (open/save/import) and Run (preview/publish/export) - so new targets
// can be added without widening the bar.

// Insert is organized by category. Shapes render as a visual grid (recognize,
// don't recall); the other categories are short labeled lists. Adding a new
// insertable means adding one entry here - the menu scales, the toolbar
// doesn't grow.
const INSERT_CATEGORIES: { id: string; label: string; types?: BlockType[] }[] = [
  { id: 'shapes', label: 'Shapes' }, // rendered as the ShapePicker grid
  { id: 'text', label: 'Text', types: ['text', 'textEntry'] },
  { id: 'media', label: 'Media', types: ['image', 'video', 'audio'] },
  { id: 'interactive', label: 'Interactive', types: ['button', 'hotspot', 'multipleChoice', 'matching', 'statement'] },
  { id: 'widgets', label: 'Widgets', types: ['code'] }
];

// The one dropdown pattern for every toolbar menu: opens on click, closes on
// outside click, Escape, or item selection (items call close()).
function ToolbarMenu({ label, title, accent, align = 'left', menuClass, children }: {
  label: ReactNode;
  title?: string;
  accent?: boolean;
  align?: 'left' | 'right';
  menuClass?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu-anchor" ref={ref}>
      <button
        className={`btn btn-icon-label ${accent ? 'btn-accent' : ''}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span className="menu-caret">{'▾'}</span>
      </button>
      {open && (
        <div className={`menu ${align === 'right' ? 'menu-right' : ''} ${menuClass ?? ''}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// A straight connector: a shape block in line mode. Arrows are the same
// block with a PowerPoint-style triangle on the end.
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

function InsertMenu({ close }: { close: () => void }) {
  const addBlock = useProjectStore((s) => s.addBlock);
  const [catId, setCatId] = useState(INSERT_CATEGORIES[0].id);
  const cat = INSERT_CATEGORIES.find((c) => c.id === catId) ?? INSERT_CATEGORIES[0];
  return (
    <div className="insert-menu">
      <div className="insert-cats">
        {INSERT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`menu-item ${c.id === catId ? 'active' : ''}`}
            onPointerEnter={() => setCatId(c.id)}
            onClick={() => setCatId(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="insert-pane">
        {cat.id === 'shapes' ? (
          <>
            <div className="field-row" style={{ marginBottom: 6 }}>
              <button className="menu-item" onClick={() => { insertLine(addBlock, false); close(); }}>
                <span className="menu-glyph">{'—'}</span> Line
              </button>
              <button className="menu-item" onClick={() => { insertLine(addBlock, true); close(); }}>
                <span className="menu-glyph">{'→'}</span> Arrow
              </button>
              <button
                className="menu-item"
                title="Insert a shape and draw its geometry with the pen tool"
                onClick={() => {
                  addBlock('shape', (b) => { b.w = 300; b.h = 300; });
                  close();
                  // addBlock selects the new block; hand it straight to the pen.
                  const id = useProjectStore.getState().selection.blockId;
                  if (id) useUiStore.getState().openPenEditor(id, 'shape');
                }}
              >
                <span className="menu-glyph">{'✎'}</span> Custom shape
              </button>
            </div>
            <ShapePicker
              onPick={(kind) => {
                addBlock('shape', (b) => { (b.props as ShapeProps).kind = kind; });
                close();
              }}
            />
          </>
        ) : (
          (cat.types ?? []).map((type) => (
            <button
              key={type}
              className="menu-item"
              onClick={() => { addBlock(type); close(); }}
            >
              <span className="menu-glyph">{BLOCKS[type].glyph}</span>
              {BLOCKS[type].label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function Toolbar({ saveState }: { saveState: 'saved' | 'saving' }) {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const setProject = useProjectStore((s) => s.setProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);
  const selection = useProjectStore((s) => s.selection);
  const fileRef = useRef<HTMLInputElement>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const pptxRef = useRef<HTMLInputElement>(null);

  const onPptx = async (file: File) => {
    try {
      const { project: imported, warnings } = await importPptx(file);
      setProject(imported);
      if (warnings.length) {
        alert('Imported with notes:\n' + warnings.slice(0, 8).join('\n'));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PPTX import failed.');
    }
  };

  const loadFromPicker = async () => {
    try {
      const loaded = await importProjectJsonWithPicker();
      if (loaded) {
        setProject(loaded);
      } else {
        fileRef.current?.click();
      }
    } catch (err: any) {
      if (err && err.name === 'AbortError') return; // User cancelled
      alert(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">eLF</span>
        <input
          className="input title-input"
          value={project.title}
          onChange={(e) => mutate((p) => { p.title = e.target.value; }, false)}
          onBlur={() => useProjectStore.getState().record()}
        />
        <span className={`save-state ${saveState}`}>{saveState === 'saving' ? 'saving...' : 'saved'}</span>
      </div>

      <div className="toolbar-group">
        <ToolbarMenu label={<><Icon.plus /> Insert</>} menuClass="menu-insert">
          {(close) => <InsertMenu close={close} />}
        </ToolbarMenu>
        <button className="btn btn-ghost btn-icon-label" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)"><Icon.undo /></button>
        <button className="btn btn-ghost btn-icon-label" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)"><Icon.redo /></button>
      </div>

      <div className="toolbar-group toolbar-right">
        <ToolbarMenu label={<><Icon.file /> File</>} align="right" title="New, save, load, and import">
          {(close) => (
            <>
              <button
                className="menu-item"
                onClick={() => {
                  close();
                  if (confirm('Replace the current project with a blank one?')) {
                    resetFileHandle();
                    setProject(createProject());
                  }
                }}
              >
                <Icon.file /> New project
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  close();
                  if (confirm('Replace the current project with the demo?')) {
                    resetFileHandle();
                    setProject(createDemoProject());
                  }
                }}
              >
                <Icon.sparkles /> Load demo project
              </button>
              <div className="menu-sep" />
              <button
                className="menu-item"
                title="Overwrites the current file; prompts only if there is no file yet"
                onClick={() => { void exportProjectJson(project); close(); }}
              >
                <Icon.save /> Save
              </button>
              <button
                className="menu-item"
                title="Always prompts for a new file, which becomes the current file"
                onClick={() => { void exportProjectJsonAs(project); close(); }}
              >
                <Icon.save /> Save as...
              </button>
              <button className="menu-item" onClick={() => { close(); void loadFromPicker(); }}>
                <Icon.load /> Load .json
              </button>
              <button className="menu-item" onClick={() => { close(); pptxRef.current?.click(); }}>
                <Icon.pptx /> Import PPTX
              </button>
            </>
          )}
        </ToolbarMenu>
        <ToolbarMenu label={<><Icon.play /> Run</>} accent align="right" title="Preview and publish the project">
          {(close) => (
            <>
              <button className="menu-item" onClick={() => { setPreviewOpen(true); close(); }}>
                <Icon.play /> Preview project
              </button>
              <button className="menu-item" onClick={() => { setPreviewOpen(true, selection.slideId); close(); }}>
                <Icon.slide /> Preview this slide
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { setPublishOpen(true); close(); }}>
                <Icon.publish /> Publish...
              </button>
            </>
          )}
        </ToolbarMenu>
        <input
          ref={pptxRef}
          type="file"
          accept=".pptx"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onPptx(file);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              resetFileHandle();
              setProject(await importProjectJson(file));
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Could not read that file.');
            }
            e.target.value = '';
          }}
        />
      </div>
      {publishOpen && <PublishDialog onClose={() => setPublishOpen(false)} />}
    </header>
  );
}
