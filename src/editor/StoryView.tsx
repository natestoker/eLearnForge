import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { Slide } from '../schema/types';
import { SlidePreview } from './SlidePreview';
import { Lucide } from './lucide';

// Story view: the whole course at a glance. Slides sit in reading order on a
// grid that wraps to the width of the dialog, so a long course scrolls down
// and never sideways. Dashed arrows are the implicit next-slide flow; solid
// accent arrows are goToSlide branches from triggers. Click a slide to jump
// to it in the editor.

const NODE_W = 184;
const GAP_X = 44;
const GAP_Y = 48;
const PAD = 32;
const NAME_H = 22;

interface NodePos { slide: Slide; index: number; x: number; y: number; row: number }

export function nodeHeight(slide: Slide | undefined): number {
  const ratio = slide ? slide.height / slide.width : 9 / 16;
  return Math.round((NODE_W - 16) * ratio) + 16 + NAME_H;
}

export function gridColumns(width: number): number {
  return Math.max(1, Math.floor((width - PAD * 2 + GAP_X) / (NODE_W + GAP_X)));
}

function buildGraph(slides: Slide[], cols: number) {
  const branchEdges: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  slides.forEach((s, i) => {
    for (const t of s.triggers) {
      for (const a of t.actions) {
        if (a.type !== 'goToSlide' || a.slideId === s.id) continue;
        if (!slides.some((sl) => sl.id === a.slideId)) continue;
        // A branch to the very next slide is the dashed arrow already there.
        if (slides[i + 1]?.id === a.slideId) continue;
        const key = `${s.id}>${a.slideId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        branchEdges.push({ from: s.id, to: a.slideId });
      }
    }
  });
  const seqEdges = slides.slice(0, -1).map((s, i) => ({ from: s.id, to: slides[i + 1].id }));

  const nodeH = nodeHeight(slides[0]);
  const pos = new Map<string, NodePos>();
  slides.forEach((s, i) => {
    const row = Math.floor(i / cols);
    pos.set(s.id, {
      slide: s,
      index: i,
      row,
      x: PAD + (i % cols) * (NODE_W + GAP_X),
      y: PAD + row * (nodeH + GAP_Y)
    });
  });
  const rows = Math.max(1, Math.ceil(slides.length / cols));
  const used = Math.min(cols, Math.max(1, slides.length));
  return {
    pos,
    nodeH,
    branchEdges,
    seqEdges,
    width: PAD * 2 + used * NODE_W + (used - 1) * GAP_X,
    height: PAD * 2 + rows * nodeH + (rows - 1) * GAP_Y
  };
}

// Next-slide flow: a short arrow along the row, or a step down through the
// gap between rows when the grid wraps.
function seqPath(a: NodePos, b: NodePos, h: number): string {
  const y1 = a.y + h / 2;
  const y2 = b.y + h / 2;
  if (a.row === b.row) return `M ${a.x + NODE_W} ${y1} H ${b.x}`;
  const out = a.x + NODE_W + GAP_X / 2;
  const back = b.x - GAP_X / 2;
  const mid = a.y + h + GAP_Y / 2;
  return `M ${a.x + NODE_W} ${y1} H ${out} V ${mid} H ${back} V ${y2} H ${b.x}`;
}

// Branches leave and arrive on the top or bottom edge so they stay clear of
// the next-slide arrows on the sides.
function branchPath(a: NodePos, b: NodePos, h: number): string {
  const ax = a.x + NODE_W / 2;
  const bx = b.x + NODE_W / 2;
  if (a.row === b.row) {
    const lift = Math.min(GAP_Y - 8, 18 + Math.abs(bx - ax) / 24);
    return `M ${ax} ${a.y} C ${ax} ${a.y - lift} ${bx} ${b.y - lift} ${bx} ${b.y}`;
  }
  if (b.row > a.row) {
    const y1 = a.y + h;
    const bend = Math.max(GAP_Y, (b.y - y1) / 2);
    return `M ${ax} ${y1} C ${ax} ${y1 + bend} ${bx} ${b.y - bend} ${bx} ${b.y}`;
  }
  const y2 = b.y + h;
  const bend = Math.max(GAP_Y, (a.y - y2) / 2);
  return `M ${ax} ${a.y} C ${ax} ${a.y - bend} ${bx} ${y2 + bend} ${bx} ${y2}`;
}

export function StoryView() {
  const slides = useProjectStore((s) => s.project.slides);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const setOpen = useUiStore((s) => s.setStoryViewOpen);

  const scroller = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(5);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fit = () => setCols(gridColumns(el.clientWidth));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graph = useMemo(() => buildGraph(slides, cols), [slides, cols]);

  const jump = (slide: Slide) => {
    select({ slideId: slide.id, layerId: slide.layers[0].id, blockId: null });
    setOpen(false);
  };

  return (
    <div className="storyview-backdrop" onClick={() => setOpen(false)}>
      <div className="storyview" onClick={(e) => e.stopPropagation()}>
        <div className="storyview-head">
          <h2>Story view</h2>
          <div className="storyview-legend">
            <span><i className="sv-line branch" /> Trigger branch</span>
            <span><i className="sv-line seq" /> Next-slide flow</span>
          </div>
          <span className="storyview-count">{slides.length} {slides.length === 1 ? 'slide' : 'slides'}</span>
          <button className="btn btn-ghost btn-icon" title="Close (Esc)" aria-label="Close" onClick={() => setOpen(false)}><Lucide name="x" size={14} /></button>
        </div>
        <div className="storyview-scroll" ref={scroller}>
          <div className="storyview-canvas" style={{ width: graph.width, height: graph.height }}>
            <svg width={graph.width} height={graph.height} className="storyview-edges">
              <defs>
                <marker id="sv-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
                </marker>
                <marker id="sv-arrow-dim" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--faint)" />
                </marker>
              </defs>
              {graph.seqEdges.map((e, i) => {
                const a = graph.pos.get(e.from); const b = graph.pos.get(e.to);
                if (!a || !b) return null;
                return <path key={`s${i}`} d={seqPath(a, b, graph.nodeH)} className="sv-edge seq" markerEnd="url(#sv-arrow-dim)" />;
              })}
              {graph.branchEdges.map((e, i) => {
                const a = graph.pos.get(e.from); const b = graph.pos.get(e.to);
                if (!a || !b) return null;
                return <path key={`b${i}`} d={branchPath(a, b, graph.nodeH)} className="sv-edge branch" markerEnd="url(#sv-arrow)" />;
              })}
            </svg>
            {[...graph.pos.values()].map(({ slide, index, x, y }) => (
              <button
                key={slide.id}
                className={`storyview-node ${slide.id === selection.slideId ? 'active' : ''}`}
                style={{ left: x, top: y, width: NODE_W, height: graph.nodeH }}
                onClick={() => jump(slide)}
                onDoubleClick={() => jump(slide)}
                title={`Go to "${slide.name}"`}
              >
                <span className="sv-thumb" style={{ aspectRatio: `${slide.width} / ${slide.height}` }}>
                  <SlidePreview slide={slide} />
                  <span className="sv-num">{index + 1}</span>
                </span>
                <span className="sv-name">{slide.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
