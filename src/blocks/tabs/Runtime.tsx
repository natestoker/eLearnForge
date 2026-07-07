import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { TabsProps } from '../../schema/types';

// Shared view used by both the canvas preview and the player. `interactive`
// enables click switching; the canvas passes false and a fixed active index.
export function TabsView({ props, accent }: { props: TabsProps; accent: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const color = props.accent || accent;

  if (props.layout === 'accordion') {
    return (
      <div className="tabs-block accordion" style={{ fontSize: props.fontSize }} onClick={(e) => e.stopPropagation()}>
        {props.panels.map((p, i) => (
          <div key={p.id} className={`acc-section ${open[i] ? 'open' : ''}`}>
            <button className="acc-head" style={open[i] ? { color } : undefined} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
              <span className="acc-caret">{open[i] ? '▾' : '▸'}</span> {p.label}
            </button>
            {open[i] && <div className="acc-body" dangerouslySetInnerHTML={{ __html: p.html }} />}
          </div>
        ))}
      </div>
    );
  }

  const cur = props.panels[Math.min(active, props.panels.length - 1)];
  return (
    <div className="tabs-block" style={{ fontSize: props.fontSize }} onClick={(e) => e.stopPropagation()}>
      <div className="tabs-strip">
        {props.panels.map((p, i) => (
          <button
            key={p.id}
            className={`tab-btn ${i === active ? 'active' : ''}`}
            style={i === active ? { color, borderBottomColor: color } : undefined}
            onClick={() => setActive(i)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {cur && <div className="tab-panel" dangerouslySetInnerHTML={{ __html: cur.html }} />}
    </div>
  );
}

export function TabsRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as TabsProps;
  const accent = runtime.project.player?.accent ?? runtime.project.theme?.accent ?? '#3ddc97';
  return <TabsView props={props} accent={accent} />;
}
