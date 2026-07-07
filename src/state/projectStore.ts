import { create } from 'zustand';
import type { Block, BlockType, Project } from '../schema/types';
import {
  createBlock, createDemoProject, createLayer, createSlide, dragDropVariableName, fillBlankVariableName,
  mcVariableName, textEntryVariableName, timerDoneVariableName, uid
} from '../schema/factory';

// History design note (open question #1 from the brief):
// snapshot history behind a single record() gate. Every user-visible mutation
// calls record() exactly once before applying; continuous gestures (drag/resize)
// call record() on pointer-down and then mutate silently, so a whole drag is
// one undo step. This is the lightweight command pattern's payoff without the
// per-command boilerplate. Cap keeps memory bounded.

const HISTORY_CAP = 100;

// --- Grouping / Recursion Helpers ---
export function walkBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap(b => b.type === 'group' ? [b, ...walkBlocks((b.props as any).blocks)] : [b]);
}

export function removeBlocksRecursive(blocks: Block[], idsToRemove: Set<string>): Block[] {
  return blocks.filter(b => !idsToRemove.has(b.id)).map(b => {
    if (b.type === 'group') {
      return { ...b, props: { ...b.props, blocks: removeBlocksRecursive((b.props as any).blocks, idsToRemove) } } as Block;
    }
    return b;
  });
}

export function mutateBlockRecursive(blocks: Block[], id: string, fn: (b: Block) => void): boolean {
  for (const b of blocks) {
    if (b.id === id) { fn(b); return true; }
    if (b.type === 'group' && mutateBlockRecursive((b.props as any).blocks, id, fn)) return true;
  }
  return false;
}

export function moveBlockZRecursive(blocks: Block[], blockId: string, dir: string): boolean {
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx >= 0) {
    const [b] = blocks.splice(idx, 1);
    if (dir === 'front') blocks.push(b);
    else if (dir === 'back') blocks.unshift(b);
    else if (dir === 'forward') blocks.splice(Math.min(blocks.length, idx + 1), 0, b);
    else if (dir === 'backward') blocks.splice(Math.max(0, idx - 1), 0, b);
    return true;
  }
  for (const b of blocks) {
    if (b.type === 'group' && moveBlockZRecursive((b.props as any).blocks, blockId, dir)) return true;
  }
  return false;
}
// ------------------------------------


export interface Selection {
  slideId: string;
  layerId: string;
  blockId: string | null;
  // Additional blocks selected (Shift-click) for alignment/distribution.
  // blockId stays the "primary" (anchor) for align-to-selection.
  blockIds?: string[];
}

interface ProjectStore {
  project: Project;
  selection: Selection;
  past: Project[];
  future: Project[];
  dirty: number; // bumps on every project change; persistence watches this

  setProject: (p: Project, resetHistory?: boolean) => void;
  select: (sel: Partial<Selection>) => void;
  record: () => void;
  // Continuous gestures (color-picker drags, canvas drags done through
  // history-recording callers): beginGesture records ONE undo snapshot and
  // then suppresses record() until endGesture, so the whole gesture is a
  // single undo step no matter how the mutations arrive.
  beginGesture: () => void;
  endGesture: () => void;
  mutate: (fn: (draft: Project) => void, history?: boolean) => void;
  undo: () => void;
  redo: () => void;

  addSlide: () => void;
  deleteSlide: (slideId: string) => void;
  moveSlide: (slideId: string, dir: -1 | 1) => void;
  addLayer: (slideId: string) => void;
  moveLayer: (layerId: string, dir: 1 | -1) => void;
  moveBlockZ: (blockId: string, dir: 'forward' | 'backward' | 'front' | 'back') => void;
  alignBlocks: (edge: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom', to: 'stage' | 'selection') => void;
  distributeBlocks: (axis: 'h' | 'v') => void;
  deleteLayer: (slideId: string, layerId: string) => void;
  // init runs on the new block after defaults/theming, e.g. to set a
  // specific shape kind picked in the Insert menu.
  addBlock: (type: BlockType, init?: (b: Block) => void) => void;
  deleteBlock: (blockId: string) => void;
  copyBlocks: () => void;
  cutBlocks: () => void;
  pasteBlocks: () => void;
  canPaste: () => boolean;
  duplicateBlocks: () => void;
  groupBlocks: () => void;
  ungroupBlocks: () => void;
  updateBlock: (blockId: string, fn: (b: Block) => void, history?: boolean) => void;
}

// Every selected block id: the primary blockId plus any Shift-added ones.
// Cross-slide clipboard for copy/cut/paste of blocks. Module-level so it
// persists across selection and slide changes within the session.
let clipboard: Block[] = [];
let pasteOffset = false;
let gestureActive = false;

export function selectedIds(sel: Selection): string[] {
  const ids = new Set<string>();
  if (sel.blockId) ids.add(sel.blockId);
  (sel.blockIds ?? []).forEach((id) => ids.add(id));
  return [...ids];
}

function initialSelection(p: Project): Selection {
  return { slideId: p.slides[0].id, layerId: p.slides[0].layers[0].id, blockId: null };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: createDemoProject(),
  selection: { slideId: '', layerId: '', blockId: null },
  past: [],
  future: [],
  dirty: 0,

  setProject: (p, resetHistory = true) =>
    set((s) => ({
      project: p,
      selection: initialSelection(p),
      past: resetHistory ? [] : s.past,
      future: resetHistory ? [] : s.future,
      dirty: s.dirty + 1
    })),

  select: (sel) => set((s) => ({ selection: { ...s.selection, ...sel } })),

  record: () => {
    if (gestureActive) return;
    set((s) => ({
      past: [...s.past.slice(-(HISTORY_CAP - 1)), structuredClone(s.project)],
      future: []
    }));
  },

  beginGesture: () => {
    if (gestureActive) return;
    get().record();
    gestureActive = true;
  },

  endGesture: () => {
    gestureActive = false;
  },

  mutate: (fn, history = true) => {
    if (history) get().record();
    set((s) => {
      const draft = structuredClone(s.project);
      fn(draft);
      return { project: draft, dirty: s.dirty + 1 };
    });
  },

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return {
        project: prev,
        past: s.past.slice(0, -1),
        future: [structuredClone(s.project), ...s.future],
        selection: reconcileSelection(s.selection, prev),
        dirty: s.dirty + 1
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        project: next,
        past: [...s.past, structuredClone(s.project)],
        future: s.future.slice(1),
        selection: reconcileSelection(s.selection, next),
        dirty: s.dirty + 1
      };
    }),

  addSlide: () => {
    const slide = createSlide(`Slide ${get().project.slides.length + 1}`);
    get().mutate((p) => { p.slides.push(slide); });
    get().select({ slideId: slide.id, layerId: slide.layers[0].id, blockId: null });
  },

  deleteSlide: (slideId) => {
    const { project, selection } = get();
    if (project.slides.length <= 1) return;
    get().mutate((p) => { p.slides = p.slides.filter((s) => s.id !== slideId); });
    if (selection.slideId === slideId) {
      const first = get().project.slides[0];
      get().select({ slideId: first.id, layerId: first.layers[0].id, blockId: null });
    }
  },

  moveSlide: (slideId, dir) => {
    get().mutate((p) => {
      const i = p.slides.findIndex((s) => s.id === slideId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.slides.length) return;
      const [s] = p.slides.splice(i, 1);
      p.slides.splice(j, 0, s);
    });
  },

  addLayer: (slideId) => {
    const layer = createLayer(`Layer ${uid('').slice(1, 4)}`);
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === slideId);
      if (!slide) return;
      layer.name = `Layer ${slide.layers.length}`;
      slide.layers.push(layer);
    });
    get().select({ layerId: layer.id, blockId: null });
  },

  moveLayer: (layerId, dir) =>
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === get().selection.slideId) ?? p.slides[0];
      const i = slide.layers.findIndex((l) => l.id === layerId);
      const j = i + dir;
      // layers[0] is the base layer and stays pinned at the bottom.
      if (i <= 0 || j <= 0 || j >= slide.layers.length) return;
      const [l] = slide.layers.splice(i, 1);
      slide.layers.splice(j, 0, l);
    }),

  moveBlockZ: (blockId, dir) =>
    get().mutate((p) => {
      for (const slide of p.slides) {
        for (const layer of slide.layers) {
          if (moveBlockZRecursive(layer.blocks, blockId, dir)) return;
        }
      }
    }),

  alignBlocks: (edge, to) =>
    get().mutate((p) => {
      const { selection } = get();
      const slide = p.slides.find((s) => s.id === selection.slideId);
      if (!slide) return;
      const ids = selectedIds(selection);
      const all = slide.layers.flatMap((l) => walkBlocks(l.blocks));
      const targets = all.filter((b) => ids.includes(b.id));
      if (targets.length === 0) return;

      // Reference rectangle: the whole stage, or the bounding box of the
      // selection (align-to-selection needs 2+ blocks to be meaningful).
      let rx = 0, ry = 0, rw = slide.width, rh = slide.height;
      if (to === 'selection') {
        if (targets.length < 2) return;
        const minX = Math.min(...targets.map((b) => b.x));
        const minY = Math.min(...targets.map((b) => b.y));
        const maxX = Math.max(...targets.map((b) => b.x + b.w));
        const maxY = Math.max(...targets.map((b) => b.y + b.h));
        rx = minX; ry = minY; rw = maxX - minX; rh = maxY - minY;
      }
      for (const b of targets) {
        if (edge === 'left') b.x = rx;
        else if (edge === 'right') b.x = rx + rw - b.w;
        else if (edge === 'hcenter') b.x = Math.round(rx + (rw - b.w) / 2);
        else if (edge === 'top') b.y = ry;
        else if (edge === 'bottom') b.y = ry + rh - b.h;
        else if (edge === 'vcenter') b.y = Math.round(ry + (rh - b.h) / 2);
      }
    }),

  distributeBlocks: (axis) =>
    get().mutate((p) => {
      const { selection } = get();
      const slide = p.slides.find((s) => s.id === selection.slideId);
      if (!slide) return;
      const ids = selectedIds(selection);
      const targets = slide.layers.flatMap((l) => walkBlocks(l.blocks)).filter((b) => ids.includes(b.id));
      if (targets.length < 3) return; // distribution needs 3+ to place gaps
      // Even spacing between block centers from first to last along the axis.
      const key = axis === 'h' ? 'x' : 'y';
      const size = axis === 'h' ? 'w' : 'h';
      const sorted = [...targets].sort((a, b) => (a[key] + a[size] / 2) - (b[key] + b[size] / 2));
      const firstC = sorted[0][key] + sorted[0][size] / 2;
      const lastC = sorted[sorted.length - 1][key] + sorted[sorted.length - 1][size] / 2;
      const step = (lastC - firstC) / (sorted.length - 1);
      sorted.forEach((b, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const center = firstC + step * i;
        b[key] = Math.round(center - b[size] / 2);
      });
    }),

  deleteLayer: (slideId, layerId) => {
    const { selection } = get();
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === slideId);
      if (!slide) return;
      const idx = slide.layers.findIndex((l) => l.id === layerId);
      if (idx <= 0) return; // base layer is not deletable
      slide.layers.splice(idx, 1);
    });
    if (selection.layerId === layerId) {
      const slide = get().project.slides.find((s) => s.id === slideId);
      if (slide) get().select({ layerId: slide.layers[0].id, blockId: null });
    }
  },

  addBlock: (type, init) => {
    const { selection } = get();
    const block = createBlock(type, 120 + Math.random() * 60, 120 + Math.random() * 60);
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === selection.slideId);
      const layer = slide?.layers.find((l) => l.id === selection.layerId) ?? slide?.layers[0];
      if (!layer) return;
      layer.blocks.push(block);
      // Multiple choice auto-registers its result variable so triggers can
      // key off it immediately (brief: mc_{blockId}_correct).
      if (type === 'multipleChoice') {
        p.variables.push({
          id: uid('var'),
          name: mcVariableName(block.id),
          type: 'boolean',
          defaultValue: false
        });
      }
      // New shapes and buttons take the course theme accent when one is set,
      // instead of the built-in mint.
      const accent = p.theme?.accent;
      if (accent && type === 'shape') {
        (block.props as { fill: string; borderColor: string }).fill = accent;
        (block.props as { borderColor: string }).borderColor = accent;
      }
      if (accent && type === 'button') {
        (block.props as { fill?: string }).fill = accent;
      }
      // Text entry auto-registers its bound string variable the same way.
      if (type === 'textEntry') {
        p.variables.push({
          id: uid('var'),
          name: textEntryVariableName(block.id),
          type: 'string',
          defaultValue: ''
        });
      }
      // Fill-in-the-blank and the countdown timer each auto-register a
      // boolean result variable so triggers can key off it immediately.
      if (type === 'fillBlank') {
        p.variables.push({ id: uid('var'), name: fillBlankVariableName(block.id), type: 'boolean', defaultValue: false });
      }
      if (type === 'timer') {
        p.variables.push({ id: uid('var'), name: timerDoneVariableName(block.id), type: 'boolean', defaultValue: false });
      }
      if (type === 'dragDrop') {
        p.variables.push({ id: uid('var'), name: dragDropVariableName(block.id), type: 'boolean', defaultValue: false });
      }
      init?.(block);
    });
    get().select({ blockId: block.id });
  },

  deleteBlock: (blockId) => {
    get().mutate((p) => {
      for (const slide of p.slides) {
        for (const layer of slide.layers) {
          layer.blocks = removeBlocksRecursive(layer.blocks, new Set([blockId]));
        }
      }
    });
    get().select({ blockId: null });
  },

  copyBlocks: () => {
    const { selection, project } = get();
    const ids = selectedIds(selection);
    const all = project.slides.flatMap((s) => s.layers.flatMap((l) => walkBlocks(l.blocks)));
    const picked = all.filter((b) => ids.includes(b.id));
    if (picked.length) clipboard = structuredClone(picked);
  },

  cutBlocks: () => {
    get().copyBlocks();
    const ids = selectedIds(get().selection);
    if (!ids.length) return;
    const idSet = new Set(ids);
    get().mutate((p) => {
      for (const slide of p.slides) {
        for (const layer of slide.layers) {
          layer.blocks = removeBlocksRecursive(layer.blocks, idSet);
        }
      }
    });
    get().select({ blockId: null, blockIds: [] });
  },

  pasteBlocks: () => {
    if (!clipboard.length) return;
    const { selection } = get();
    const newIds: string[] = [];
    get().mutate((p) => {
      // Paste onto the currently selected layer of the current slide, so
      // copying from the base layer to another layer/slide is just: select
      // the target layer, then paste. Offset a touch so copies are visible.
      const slide = p.slides.find((s) => s.id === selection.slideId) ?? p.slides[0];
      const layer = slide.layers.find((l) => l.id === selection.layerId) ?? slide.layers[0];
      for (const b of clipboard) {
        const clone = structuredClone(b);
        clone.id = uid('blk');
        // Paste in place: keep the original coordinates. Duplicate (Ctrl+D)
        // nudges via a separate path so a same-layer copy stays visible.
        if (pasteOffset) { clone.x += 20; clone.y += 20; }
        layer.blocks.push(clone);
        newIds.push(clone.id);
      }
    });
    // Select the pasted blocks (primary = last).
    if (newIds.length) {
      get().select({ blockId: newIds[newIds.length - 1], blockIds: newIds.slice(0, -1) });
    }
  },

  canPaste: () => clipboard.length > 0,

  duplicateBlocks: () => {
    get().copyBlocks();
    pasteOffset = true;
    get().pasteBlocks();
    pasteOffset = false;
  },

  groupBlocks: () => {
    const ids = selectedIds(get().selection);
    if (ids.length < 2) return;
    const idSet = new Set(ids);
    const gid = uid('grp');
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === get().selection.slideId) ?? p.slides[0];
      const layer = slide.layers.find((l) => l.id === get().selection.layerId) ?? slide.layers[0];
      
      const all = walkBlocks(layer.blocks);
      const targets = all.filter(b => idSet.has(b.id));
      if (targets.length < 2) return;

      const minX = Math.min(...targets.map(b => b.x));
      const minY = Math.min(...targets.map(b => b.y));
      const maxX = Math.max(...targets.map(b => b.x + b.w));
      const maxY = Math.max(...targets.map(b => b.y + b.h));

      // Adjust child coords to be relative
      const children = targets.map(b => ({ ...b, x: b.x - minX, y: b.y - minY }));

      const groupBlock: Block = {
        id: gid,
        type: 'group',
        name: 'Group',
        x: minX, y: minY, w: maxX - minX, h: maxY - minY,
        props: { blocks: children }
      };

      layer.blocks = removeBlocksRecursive(layer.blocks, idSet);
      layer.blocks.push(groupBlock);
    });
    get().select({ blockId: gid, blockIds: [] });
  },

  ungroupBlocks: () => {
    const ids = selectedIds(get().selection);
    if (!ids.length) return;
    const idSet = new Set(ids);
    const newSel: string[] = [];
    get().mutate((p) => {
      const slide = p.slides.find((s) => s.id === get().selection.slideId) ?? p.slides[0];
      const layer = slide.layers.find((l) => l.id === get().selection.layerId) ?? slide.layers[0];
      
      const groupsToUngroup = walkBlocks(layer.blocks).filter(b => b.type === 'group' && idSet.has(b.id));
      if (!groupsToUngroup.length) return;

      const idsToRemove = new Set(groupsToUngroup.map(g => g.id));
      layer.blocks = removeBlocksRecursive(layer.blocks, idsToRemove);

      for (const g of groupsToUngroup) {
        const children = (g.props as any).blocks as Block[];
        for (const child of children) {
          child.x += g.x;
          child.y += g.y;
          layer.blocks.push(child);
          newSel.push(child.id);
        }
      }
    });
    if (newSel.length) {
      get().select({ blockId: newSel[newSel.length - 1], blockIds: newSel.slice(0, -1) });
    }
  },

  updateBlock: (blockId, fn, history = true) => {
    get().mutate((p) => {
      for (const slide of p.slides) {
        for (const layer of slide.layers) {
          if (mutateBlockRecursive(layer.blocks, blockId, fn)) return;
        }
      }
    }, history);
  }
}));

function reconcileSelection(sel: Selection, p: Project): Selection {
  const slide = p.slides.find((s) => s.id === sel.slideId) ?? p.slides[0];
  const layer = slide.layers.find((l) => l.id === sel.layerId) ?? slide.layers[0];
  const blockExists = slide.layers.some((l) => walkBlocks(l.blocks).some((b) => b.id === sel.blockId));
  return { slideId: slide.id, layerId: layer.id, blockId: blockExists ? sel.blockId : null };
}

// Initialize selection once the store exists.
useProjectStore.setState((s) => ({ selection: initialSelection(s.project) }));

export function useCurrentSlide() {
  return useProjectStore((s) =>
    s.project.slides.find((sl) => sl.id === s.selection.slideId) ?? s.project.slides[0]
  );
}

export function useSelectedBlock(): Block | null {
  return useProjectStore((s) => {
    if (!s.selection.blockId) return null;
    const slide = s.project.slides.find((sl) => sl.id === s.selection.slideId);
    if (!slide) return null;
    // Recurse into groups so a child selected from the timeline (or by
    // double-clicking a group) gets a real property panel.
    for (const layer of slide.layers) {
      const b = walkBlocks(layer.blocks).find((bl) => bl.id === s.selection.blockId);
      if (b) return b;
    }
    return null;
  });
}

// Test hook: expose the store on window in dev/preview so Playwright can
// assert store state directly. Harmless in production (no test reads it).
if (typeof window !== 'undefined') {
  (window as unknown as { __forgeStore?: typeof useProjectStore }).__forgeStore = useProjectStore;
}
