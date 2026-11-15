import type { CanvasRendererProps } from '../blockApi';
import type { ResultsProps } from '../../schema/types';
import { labelStyleCss } from '../../shared/labelStyle';
import { useProjectStore } from '../../state/projectStore';
import { passingScoreOf } from '../../engine/scoring';

// Authoring preview with a sample passing score so the layout is visible.
export function ResultsCanvas({ block }: CanvasRendererProps) {
  const props = block.props as ResultsProps;
  const pass = passingScoreOf(useProjectStore((s) => s.project));
  const sample = Math.max(pass, 85);
  return (
    <div className="rs-block" style={{ textAlign: props.align }}>
      <div className="rs-heading" style={labelStyleCss(props.labelStyle)}>{props.heading}</div>
      <div className="rs-score pass" style={{ fontSize: props.fontSize }}>{sample}%</div>
      {props.showPassMark && <div className="rs-passmark">Pass mark: {pass}%</div>}
      <p className="rs-message pass">{props.passMessage}</p>
    </div>
  );
}
