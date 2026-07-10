import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { LabeledGraphicProps } from '../../schema/types';
import { labeledGraphicDoneVariableName } from '../../schema/factory';

// Numbered pins over the image; clicking opens a popup card anchored to the
// pin (flipping to whichever side has room). Opening every pin once sets
// lg_{blockId}_done for gating triggers.
export function LabeledGraphicRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as LabeledGraphicProps;
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  const open = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    setSeen((s) => {
      if (s[id]) return s;
      const next = { ...s, [id]: true };
      if (props.markers.every((m) => next[m.id])) {
        runtime.setVariableByName(labeledGraphicDoneVariableName(block.id), true);
      }
      return next;
    });
  };

  const current = props.markers.find((m) => m.id === openId);

  return (
    <div className="lg-block live" onClick={(e) => e.stopPropagation()}>
      {props.src
        ? <img className="lg-img" src={props.src} style={{ objectFit: props.fit }} alt="" />
        : <div className="lg-placeholder" />}
      {props.markers.map((m, i) => (
        <button
          key={m.id}
          className={`lg-pin live ${openId === m.id ? 'open' : ''} ${seen[m.id] ? 'seen' : ''}`}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          onClick={() => open(m.id)}
          aria-expanded={openId === m.id}
          aria-label={`Marker ${i + 1}: ${m.title}`}
        >
          {i + 1}
        </button>
      ))}
      {current && (
        <div
          className="lg-popup"
          style={{
            left: `${Math.min(Math.max(current.x, 22), 78)}%`,
            top: current.y > 55 ? `${current.y}%` : undefined,
            bottom: current.y <= 55 ? `${100 - current.y}%` : undefined,
            transform: current.y > 55 ? 'translate(-50%, calc(-100% - 18px))' : 'translate(-50%, 18px)'
          }}
          role="dialog"
          aria-label={current.title}
        >
          <div className="lg-popup-head">
            <b>{current.title}</b>
            <button className="lg-popup-close" onClick={() => setOpenId(null)} aria-label="Close">×</button>
          </div>
          <p>{current.body}</p>
        </div>
      )}
    </div>
  );
}
