import type { CanvasRendererProps } from '../blockApi';
import type { LabeledGraphicProps } from '../../schema/types';

export function LabeledGraphicCanvas({ block }: CanvasRendererProps) {
  const props = block.props as LabeledGraphicProps;
  return (
    <div className="lg-block">
      {props.src
        ? <img className="lg-img" src={props.src} style={{ objectFit: props.fit }} alt="" />
        : <div className="lg-placeholder">Labeled graphic — set an image in Format</div>}
      {props.markers.map((m, i) => (
        <span key={m.id} className="lg-pin" style={{ left: `${m.x}%`, top: `${m.y}%` }} title={m.title}>
          {i + 1}
        </span>
      ))}
    </div>
  );
}
