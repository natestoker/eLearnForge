import { useMemo } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore } from '../state/uiStore';
import type { Slide } from '../schema/types';

// Story view: the whole course as a graph (Storyline's story view). Slides
// are nodes laid out in columns by flow depth; solid mint arrows are
// explicit goToSlide branches from triggers, dashed arrows are the implicit
// next-slide flow. Click a slide to jump to it in the editor.

const NODE_W = 170;
const NODE_H = 128;
const GAP_X = 90;
const GAP_Y = 28;
const PAD = 48;

interface NodePos { slide: Slide; index: number; x: number; y: number }

function buildGraph(slides: Slide[]) {
  const branchEdges: { from: string; to: string }[] = [];
  for (const s of slides) {
    for (const t of s.triggers) {
      for (const a of t.actions) {
        if (a.type === 'goToSlide' && slides.some((sl) => sl.id === a.slideId)) {
          branchEdges.push({ from: s.id, to: a.slideId });
        }
      }
    }
  }
  const seqEdges = slides.slice(0, -1).map((s, i) => ({ from: s.id, to: slides[i + 1].id }));

  // Columns by BFS depth over all edges, starting from the first slide.
  const depth = new Map<string, number>();
  if (slides.length) depth.set(slides[0].id, 0);
  const queue = slides.length ? [slides[0].id] : [];
  const all = [...seqEdges, ...branchEdges];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of all) {
      if (e.from === cur && !depth.has(e.to)) {
        depth.set(e.to, (depth.get(cur) ?? 0) + 1);
        queue.push(e.to);
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  slides.forEach((s) => { if (!depth.has(s.id)) depth.set(s.id, maxDepth + 1); });

  const byCol = new Map<number, Slide[]>();
  slides.forEach((s) => {
    const d = depth.get(s.id)!;
    byCol.set(d, [...(byCol.get(d) ?? []), s]);
  });

  const pos = new Map<string, NodePos>();
  for (const [col, colSlides] of byCol) {
    colSlides.forEach((s, row) => {
      pos.set(s.id, {
        slide: s,
        index: slides.indexOf(s),
        x: PAD + col * (NODE_W + GAP_X),
        y: PAD + row * (NODE_H + GAP_Y)
      });
    });
  }
  const cols = Math.max(...[...byCol.keys()]) + 1;
  const rows = Math.max(...[...byCol.values()].map((c) => c.length));
  return {
    pos,
    branchEdges,
    seqEdges,
    width: PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X,
    height: PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y
  };
}

function edgePath(a: NodePos, b: NodePos): string {
  // Right edge of the source to the left edge of the target; loop-backs
  // swing underneath so they read as returns.
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  if (x2 > x1) {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  }
  const dip = Math.max(a.y, b.y) + NODE_H + 26;
  return `M ${a.x + NODE_W / 2} ${a.y + NODE_H} C ${a.x + NODE_W / 2} ${dip} ${b.x + NODE_W / 2} ${dip} ${b.x + NODE_W / 2} ${b.y + NODE_H}`;
}

export function StoryView() {
  const slides = useProjectStore((s) => s.project.slides);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const setOpen = useUiStore((s) => s.setStoryViewOpen);

  const graph = useMemo(() => buildGraph(slides), [slides]);

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
          <button className="btn btn-ghost btn-icon" title="Close (Esc)" onClick={() => setOpen(false)}>x</button>
        </div>
        <div className="storyview-scroll">
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
                return <path key={`s${i}`} d={edgePath(a, b)} className="sv-edge seq" markerEnd="url(#sv-arrow-dim)" />;
              })}
              {graph.branchEdges.map((e, i) => {
                const a = graph.pos.get(e.from); const b = graph.pos.get(e.to);
                if (!a || !b) return null;
                return <path key={`b${i}`} d={edgePath(a, b)} className="sv-edge branch" markerEnd="url(#sv-arrow)" />;
              })}
            </svg>
            {[...graph.pos.values()].map(({ slide, index, x, y }) => (
              <button
                key={slide.id}
                className={`storyview-node ${slide.id === selection.slideId ? 'active' : ''}`}
                style={{ left: x, top: y, width: NODE_W }}
                onClick={() => jump(slide)}
                onDoubleClick={() => jump(slide)}
                title={`Go to "${slide.name}"`}
              >
                <span className="sv-thumb">
                  <svg viewBox={`0 0 ${slide.width} ${slide.height}`} preserveAspectRatio="none" aria-hidden="true">
                    {(slide.layers[0]?.blocks ?? []).slice(0, 24).map((b) => (
                      <rect key={b.id} className="wire" x={b.x} y={b.y} width={Math.max(b.w, 8)} height={Math.max(b.h, 8)} rx={6} />
                    ))}
                  </svg>
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
