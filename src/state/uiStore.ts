import { create } from 'zustand';

// Editor-only state. Deliberately separate from the project store: nothing in
// here is part of the document, so it never touches undo history or saves.

export type RightTab = 'properties' | 'effects' | 'animate' | 'triggers' | 'variables';

interface UiStore {
  hiddenLayerIds: Record<string, boolean>; // editor-only eye toggle
  rightTab: RightTab;
  snapEnabled: boolean;
  setSnapEnabled: (on: boolean) => void;
  timelineSnap: boolean;
  setTimelineSnap: (on: boolean) => void;
  panelSizes: { left: number; right: number; timeline: number };
  setPanelSize: (key: 'left' | 'right' | 'timeline', px: number) => void;
  collapsed: { left: boolean; right: boolean; timeline: boolean };
  toggleCollapsed: (key: 'left' | 'right' | 'timeline') => void;
  // Pen editor: draw/edit a custom polygon for a shape block or an image clip.
  penEditor: { blockId: string; mode: 'shape' | 'imageClip' } | null;
  openPenEditor: (blockId: string, mode: 'shape' | 'imageClip') => void;
  closePenEditor: () => void;
  previewOpen: boolean;
  previewStartSlideId: string | null;
  toggleLayerHidden: (layerId: string) => void;
  setRightTab: (tab: RightTab) => void;
  setPreviewOpen: (open: boolean, startSlideId?: string | null) => void;
  // Editor timeline playhead (seconds). null = no scrub preview; the canvas
  // shows every block at rest. Transient, never saved.
  scrubT: number | null;
  setScrubT: (t: number | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hiddenLayerIds: {},
  rightTab: 'properties',
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
  setRightTab: (tab) => set({ rightTab: tab }),
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
  scrubT: null,
  setScrubT: (t) => set({ scrubT: t })
}));
