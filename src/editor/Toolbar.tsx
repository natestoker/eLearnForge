import { useRef } from 'react';
import { Icon } from './icons';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { BLOCKS } from '../blocks/registry';
import type { BlockType } from '../schema/types';

const INSERT_GROUPS: { title: string; types: BlockType[] }[] = [
  { title: 'Basics', types: ['text', 'shape', 'image', 'button'] },
  { title: 'Media', types: ['video', 'audio'] },
  { title: 'Interactive', types: ['multipleChoice', 'matching', 'textEntry', 'hotspot', 'statement', 'code'] }
];
import { exportProjectJson, importProjectJson, importProjectJsonWithPicker, resetFileHandle } from '../state/persistence';
import { createDemoProject, createProject } from '../schema/factory';
import { useState } from 'react';
import { PublishDialog } from './PublishDialog';
import { importPptx } from '../publish/pptxImport';

export function Toolbar({ saveState }: { saveState: 'saved' | 'saving' }) {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const setProject = useProjectStore((s) => s.setProject);
  const addBlock = useProjectStore((s) => s.addBlock);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);
  const selection = useProjectStore((s) => s.selection);
  const fileRef = useRef<HTMLInputElement>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
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
        <div className="menu-anchor">
          <button className="btn" onClick={() => setInsertOpen((o) => !o)}>
            Insert v
          </button>
          {insertOpen && (
            <div className="menu" onPointerLeave={() => setInsertOpen(false)}>
              {INSERT_GROUPS.map((group) => (
                <div key={group.title} className="menu-group">
                  <div className="menu-group-title">{group.title}</div>
                  {group.types.map((type) => (
                    <button
                      key={type}
                      className="menu-item"
                      onClick={() => {
                        addBlock(type);
                        setInsertOpen(false);
                      }}
                    >
                      <span className="menu-glyph">{BLOCKS[type].glyph}</span>
                      {BLOCKS[type].label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-group">
        <button className="btn btn-ghost btn-icon-label" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)"><Icon.undo /></button>
        <button className="btn btn-ghost btn-icon-label" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)"><Icon.redo /></button>
      </div>

      <div className="toolbar-group toolbar-right">
        <button
          className="btn btn-ghost btn-icon-label"
          title="Start over with a blank project"
          onClick={() => {
            if (confirm('Replace the current project with a blank one?')) {
              resetFileHandle();
              setProject(createProject());
            }
          }}
        >
          <Icon.file /> New
        </button>
        <button
          className="btn btn-ghost btn-icon-label"
          title="Load the demo project"
          onClick={() => {
            if (confirm('Replace the current project with the demo?')) {
              resetFileHandle();
              setProject(createDemoProject());
            }
          }}
        >
          <Icon.sparkles /> Demo
        </button>
        <button className="btn btn-ghost btn-icon-label" onClick={() => exportProjectJson(project)} title="Save the project as a .json file"><Icon.save /> Save</button>
        <button
          className="btn btn-ghost btn-icon-label"
          title="Load a saved .json project"
          onClick={async () => {
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
          }}
        >
          <Icon.load /> Load
        </button>
        <button className="btn btn-ghost btn-icon-label" onClick={() => pptxRef.current?.click()} title="Import a PowerPoint as an editable starting point">
          <Icon.pptx /> Import PPTX
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
        <button className="btn btn-accent btn-icon-label" onClick={() => setPreviewOpen(true)}><Icon.play /> Preview</button>
        <button
          className="btn btn-icon-label"
          title="Preview from the current slide"
          onClick={() => setPreviewOpen(true, selection.slideId)}
        >
          <Icon.slide /> This slide
        </button>
        <button className="btn btn-accent btn-icon-label" onClick={() => setPublishOpen(true)}><Icon.publish /> Publish</button>
      </div>
      {publishOpen && <PublishDialog onClose={() => setPublishOpen(false)} />}
    </header>
  );
}
