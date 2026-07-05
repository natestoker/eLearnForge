import type { PropertiesRendererProps } from '../blockApi';
import type { MatchingProps, MatchPair } from '../../schema/types';
import { Field, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function MatchingProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as MatchingProps;
  const setPair = (id: string, patch: Partial<MatchPair>) =>
    onUpdateProps((p: MatchingProps) => {
      const pair = p.pairs.find((x) => x.id === id);
      if (pair) Object.assign(pair, patch);
    });
  return (
    <>
      <Field label="Question / instruction">
        <TextInput value={props.question} onChange={(v) => onUpdateProps((p: MatchingProps) => { p.question = v; })} />
      </Field>
      <div className="panel-subtitle" style={{ marginTop: 8 }}>Pairs</div>
      {props.pairs.map((pair) => (
        <div key={pair.id} className="match-pair-edit">
          <TextInput value={pair.left} placeholder="Prompt" onChange={(v) => setPair(pair.id, { left: v })} />
          <span className="match-arrow">{'\u2194'}</span>
          <TextInput value={pair.right} placeholder="Answer" onChange={(v) => setPair(pair.id, { right: v })} />
          <button className="btn btn-ghost btn-icon btn-danger" onClick={() => onUpdateProps((p: MatchingProps) => { p.pairs = p.pairs.filter((x) => x.id !== pair.id); })}>x</button>
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: MatchingProps) => { p.pairs.push({ id: uid('pair'), left: '', right: '' }); })}>+ Add pair</button>
      <Field label="Correct feedback">
        <TextInput value={props.feedbackCorrect} onChange={(v) => onUpdateProps((p: MatchingProps) => { p.feedbackCorrect = v; })} />
      </Field>
      <Field label="Incorrect feedback">
        <TextInput value={props.feedbackIncorrect} onChange={(v) => onUpdateProps((p: MatchingProps) => { p.feedbackIncorrect = v; })} />
      </Field>
    </>
  );
}
