import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import {
  chooseProjectFolder, exportProjectJson, exportProjectJsonAs, folderModeAvailable,
  importProjectJson, importProjectJsonWithPicker, resetFileHandle
} from '../state/persistence';
import { createDemoProject, createProject } from '../schema/factory';
import { PublishDialog } from './PublishDialog';
import { importPptx } from '../publish/pptxImport';

// Toolbar layout principle: the bar itself holds only the always-on editing
// actions (Insert, Undo/Redo); everything project-level lives in two menus -
// File (open/save/import) and Run (preview/publish/export) - so new targets
// can be added without widening the bar.

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
        <span className="brand-mark">eF</span>
        <span className="brand-name">eLearnForge</span>
        <input
          className="input title-input"
          value={project.title}
          onChange={(e) => mutate((p) => { p.title = e.target.value; }, false)}
          onBlur={() => useProjectStore.getState().record()}
        />
        <span className={`save-state ${saveState}`}>{saveState === 'saving' ? 'saving…' : 'saved'}</span>
      </div>

      <div className="toolbar-group">
        <button className="iconbtn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)"><Icon.undo /></button>
        <button className="iconbtn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)"><Icon.redo /></button>
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
              {folderModeAvailable() && (
                <button
                  className="menu-item"
                  title="Pick a folder once; Save then writes <title>.elearnforge.json there with no prompts at all"
                  onClick={async () => {
                    close();
                    if (await chooseProjectFolder()) void exportProjectJson(project);
                  }}
                >
                  <Icon.load /> Set project folder...
                </button>
              )}
              <button className="menu-item" onClick={() => { close(); void loadFromPicker(); }}>
                <Icon.load /> Load .json
              </button>
              <button className="menu-item" onClick={() => { close(); pptxRef.current?.click(); }}>
                <Icon.pptx /> Import PPTX
              </button>
            </>
          )}
        </ToolbarMenu>
        <div className="toolbar-divider" />
        <ToolbarMenu label={<><Icon.play /> Preview</>} align="right" title="Run the project in the player">
          {(close) => (
            <>
              <button className="menu-item" onClick={() => { setPreviewOpen(true); close(); }}>
                <Icon.play /> Preview project
              </button>
              <button className="menu-item" onClick={() => { setPreviewOpen(true, selection.slideId); close(); }}>
                <Icon.slide /> Preview this slide
              </button>
            </>
          )}
        </ToolbarMenu>
        <button className="btn btn-accent" onClick={() => setPublishOpen(true)} title="Package the course for SCORM / web">
          Publish
        </button>
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
