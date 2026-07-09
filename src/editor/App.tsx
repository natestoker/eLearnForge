import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import { loadProject, restoreFileHandle, saveProject } from '../state/persistence';
import { Ribbon } from './Ribbon';
import { SlidesPanel } from './SlidesPanel';
import { LayersPanel } from './LayersPanel';
import { EditorCanvas } from './EditorCanvas';
import { TimelinePanel } from './TimelinePanel';
import { Splitter } from './Splitter';
import { PenEditor } from './PenEditor';
import { ensureFont, ensureEmbeddedFonts } from '../shared/fonts';
import { Player } from '../runtime/Player';

export function App() {
  const dirty = useProjectStore((s) => s.dirty);
  const previewOpen = useUiStore((s) => s.previewOpen);
  const previewStartSlideId = useUiStore((s) => s.previewStartSlideId);
  const panelSizes = useUiStore((s) => s.panelSizes);
  const collapsed = useUiStore((s) => s.collapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);
  const fonts = useProjectStore((s) => s.project.fonts);
  const embeddedFonts = useProjectStore((s) => s.project.embeddedFonts);
  useEffect(() => { (fonts ?? []).forEach((f) => ensureFont(f)); }, [fonts]);
  useEffect(() => { ensureEmbeddedFonts(embeddedFonts); }, [embeddedFonts]);
  const setPreviewOpen = useUiStore((s) => s.setPreviewOpen);

  const [booted, setBooted] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const saveTimer = useRef<number>();

  // Boot: restore the last autosave if there is one, and the last session's
  // save-file handle so Save keeps overwriting the same file after a reload.
  useEffect(() => {
    void restoreFileHandle();
    loadProject()
      .then((p) => { if (p) useProjectStore.getState().setProject(p); })
      .catch(() => { /* fresh profile or blocked IDB; demo project stands */ })
      .finally(() => setBooted(true));
  }, []);

  // Autosave: debounce project changes into IndexedDB.
  useEffect(() => {
    if (!booted) return;
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProject(useProjectStore.getState().project)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('saved'));
    }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [dirty, booted]);

  // Global undo/redo keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) useProjectStore.getState().redo();
        else useProjectStore.getState().undo();
      }
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPreviewOpen]);

  return (
    <div className="app bg-background text-on-surface font-body-sm overflow-hidden h-screen flex flex-col">
      <Ribbon saveState={saveState} />
      <div className="workspace flex-1 flex overflow-hidden">
        {collapsed.left ? (
          <button className="panel-rail left" onClick={() => toggleCollapsed('left')} title="Show slides & layers">
            <span className="rail-label">Slides / Layers</span>
          </button>
        ) : (
          <>
            <aside className="sidebar-left bg-surface-container-low border-r border-outline-variant" style={{ width: panelSizes.left }}>
              <button className="panel-collapse-btn" onClick={() => toggleCollapsed('left')} title="Hide this panel">{'\u2039'}</button>
              <SlidesPanel />
              <LayersPanel />
            </aside>
            <Splitter target="left" />
          </>
        )}
        <main className="center flex-1 bg-surface flex flex-col relative overflow-hidden technical-grid">
          <EditorCanvas />
          {!collapsed.timeline && <Splitter target="timeline" />}
          {collapsed.timeline ? (
            <button className="panel-rail bottom" onClick={() => toggleCollapsed('timeline')} title="Show timeline">
              <span className="rail-label">Timeline</span>
            </button>
          ) : (
            <TimelinePanel maxHeight={panelSizes.timeline} onCollapse={() => toggleCollapsed('timeline')} />
          )}
        </main>
      </div>

      {previewOpen && <PreviewModal startSlideId={previewStartSlideId} onClose={() => setPreviewOpen(false)} />}
      <PenEditor />
    </div>
  );
}

function PreviewModal({ onClose, startSlideId }: { onClose: () => void; startSlideId: string | null }) {
  // Snapshot the project once on open so authoring edits mid-preview cannot
  // desync a live runtime.
  const [snapshot] = useState(() => structuredClone(useProjectStore.getState().project));
  return (
    <div className="preview-overlay">
      <div className="preview-chrome">
        <span>Preview - runtime engine live</span>
        <button className="btn btn-ghost" onClick={onClose}>Close (Esc)</button>
      </div>
      <Player project={snapshot} startSlideId={startSlideId ?? undefined} />
    </div>
  );
}
