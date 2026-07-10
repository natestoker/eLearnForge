import { create } from 'zustand';

// Editor-only state. Deliberately separate from the project store: nothing in
// here is part of the document, so it never touches undo history or saves.

export type RibbonTab = 'home' | 'slide' | 'insert' | 'format' | 'animations' | 'triggers' | 'variables';

interface UiStore {
  hiddenLayerIds: Record<string, boolean>; // editor-only eye toggle
  ribbonTab: RibbonTab;
  snapEnabled: boolean;
  setSnapEnabled: (on: boolean) => void;
  timelineSnap: boolean;
  setTimelineSnap: (on: boolean) => void;
  panelSizes: { left: number; right: number; timeline: number };
  setPanelSize: (key: 'left' | 'right' | 'timeline', px: number) => void;
  collapsed: { left: boolean; right: boolean; timeline: boolean };
  toggleCollapsed: (key: 'left' | 'right' | 'timeline') => void;
  // Office-style ribbon collapse: the tab row stays, the shelf hides.
  ribbonCollapsed: boolean;
  toggleRibbonCollapsed: () => void;
  // Collapse the layers half of the left sidebar down to its header.
  layersCollapsed: boolean;
  toggleLayersCollapsed: () => void;
  // Story view: the slide-graph overview (branching like Storyline).
  storyViewOpen: boolean;
  setStoryViewOpen: (open: boolean) => void;
  // Visible layout grid on the stage (snap is separate - snapEnabled).
  showGrid: boolean;
  toggleShowGrid: () => void;
  // First-run welcome / quick tour; reopenable from the toolbar Help button.
  welcomeOpen: boolean;
  setWelcomeOpen: (open: boolean) => void;
  // Pen editor: draw/edit a custom polygon for a shape block or an image clip.
  penEditor: { blockId: string; mode: 'shape' | 'imageClip' } | null;
  openPenEditor: (blockId: string, mode: 'shape' | 'imageClip') => void;
  closePenEditor: () => void;
  previewOpen: boolean;
  previewStartSlideId: string | null;
  toggleLayerHidden: (layerId: string) => void;
  setRibbonTab: (tab: RibbonTab) => void;
  setPreviewOpen: (open: boolean, startSlideId?: string | null) => void;
  // Editor timeline playhead (seconds). null = no scrub preview; the canvas
  // shows every block at rest. Transient, never saved.
  scrubT: number | null;
  setScrubT: (t: number | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hiddenLayerIds: {},
  ribbonTab: 'home',
  snapEnabled: true,
  timelineSnap: true,
  panelSizes: (() => {
    try { return { left: 240, right: 320, timeline: 180, ...JSON.parse(localStorage.getItem('elearnforge.panels') ?? '{}') }; }
    catch { return { left: 240, right: 320, timeline: 180 }; }
  })(),
  previewOpen: false,
  previewStartSlideId: null,
  collapsed: (() => {
    try { return { left: false, right: false, timeline: false, ...JSON.parse(localStorage.getItem('elearnforge.collapsed') ?? '{}') }; }
    catch { return { left: false, right: false, timeline: false }; }
  })(),
  toggleLayerHidden: (layerId) =>
    set((s) => ({
      hiddenLayerIds: { ...s.hiddenLayerIds, [layerId]: !s.hiddenLayerIds[layerId] }
    })),
  setRibbonTab: (tab) => set({ ribbonTab: tab }),
  setSnapEnabled: (on) => set({ snapEnabled: on }),
  setTimelineSnap: (on) => set({ timelineSnap: on }),
  setPanelSize: (key, px) =>
    set((s) => {
      const sizes = { ...s.panelSizes, [key]: px };
      try { localStorage.setItem('elearnforge.panels', JSON.stringify(sizes)); } catch { /* ignore */ }
      return { panelSizes: sizes };
    }),
  penEditor: null,
  openPenEditor: (blockId, mode) => set({ penEditor: { blockId, mode } }),
  closePenEditor: () => set({ penEditor: null }),
  toggleCollapsed: (key) =>
    set((s) => {
      const collapsed = { ...s.collapsed, [key]: !s.collapsed[key] };
      try { localStorage.setItem('elearnforge.collapsed', JSON.stringify(collapsed)); } catch { /* ignore */ }
      return { collapsed };
    }),
  setPreviewOpen: (open, startSlideId = null) => set({ previewOpen: open, previewStartSlideId: open ? startSlideId : null }),
  ribbonCollapsed: (() => {
    try { return localStorage.getItem('elearnforge.ribbonCollapsed') === '1'; } catch { return false; }
  })(),
  toggleRibbonCollapsed: () =>
    set((s) => {
      const v = !s.ribbonCollapsed;
      try { localStorage.setItem('elearnforge.ribbonCollapsed', v ? '1' : '0'); } catch { /* ignore */ }
      return { ribbonCollapsed: v };
    }),
  layersCollapsed: (() => {
    try { return localStorage.getItem('elearnforge.layersCollapsed') === '1'; } catch { return false; }
  })(),
  toggleLayersCollapsed: () =>
    set((s) => {
      const v = !s.layersCollapsed;
      try { localStorage.setItem('elearnforge.layersCollapsed', v ? '1' : '0'); } catch { /* ignore */ }
      return { layersCollapsed: v };
    }),
  storyViewOpen: false,
  setStoryViewOpen: (open) => set({ storyViewOpen: open }),
  showGrid: (() => {
    try { return localStorage.getItem('elearnforge.showGrid') === '1'; } catch { return false; }
  })(),
  toggleShowGrid: () =>
    set((s) => {
      const v = !s.showGrid;
      try { localStorage.setItem('elearnforge.showGrid', v ? '1' : '0'); } catch { /* ignore */ }
      return { showGrid: v };
    }),
  welcomeOpen: false,
  setWelcomeOpen: (open) => set({ welcomeOpen: open }),
  scrubT: null,
  setScrubT: (t) => set({ scrubT: t })
}));
