import { useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { FlashcardsProps } from '../../schema/types';
import { flashcardsDoneVariableName } from '../../schema/factory';

// Click to flip. Every card seen at least once sets fc_{blockId}_done so a
// trigger can gate Next on "reviewed all cards".
export function FlashcardsRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as FlashcardsProps;
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  const flip = (id: string) => {
    setFlipped((f) => ({ ...f, [id]: !f[id] }));
    setSeen((s) => {
      if (s[id]) return s;
      const next = { ...s, [id]: true };
      if (props.cards.every((c) => next[c.id])) {
        runtime.setVariableByName(flashcardsDoneVariableName(block.id), true);
      }
      return next;
    });
  };

  return (
    <div className="fc-block live" style={{ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }} onClick={(e) => e.stopPropagation()}>
      {props.cards.map((c) => (
        <button
          key={c.id}
          className={`fc-card ${flipped[c.id] ? 'flipped' : ''}`}
          onClick={() => flip(c.id)}
          aria-pressed={!!flipped[c.id]}
          aria-label={flipped[c.id] ? `${c.front}: ${c.back}` : `${c.front} - select to reveal`}
        >
          <span className="fc-inner">
            <span className="fc-face front">{c.front}</span>
            <span className="fc-face back" style={props.accent ? { background: props.accent } : undefined}>{c.back}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
