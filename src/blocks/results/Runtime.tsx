import type { RuntimeRendererProps } from '../blockApi';
import type { ResultsProps } from '../../schema/types';
import { passingScoreOf } from '../../engine/scoring';

// Live results card. The player re-renders blocks on every runtime change, so
// the score and the pass or fail message follow the learner as they answer.
export function ResultsRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as ResultsProps;
  const score = runtime.getScore();
  const pass = passingScoreOf(runtime.project);
  const passed = score !== null && score >= pass;
  return (
    <div className="rs-block live" style={{ textAlign: props.align }} role="status" aria-live="polite">
      <div className="rs-heading">{props.heading}</div>
      {score === null ? (
        <p className="rs-message">{props.noScoreMessage}</p>
      ) : (
        <>
          <div className={`rs-score ${passed ? 'pass' : 'fail'}`} style={{ fontSize: props.fontSize }}>{score}%</div>
          {props.showPassMark && <div className="rs-passmark">Pass mark: {pass}%</div>}
          <p className={`rs-message ${passed ? 'pass' : 'fail'}`}>{passed ? props.passMessage : props.failMessage}</p>
        </>
      )}
    </div>
  );
}
