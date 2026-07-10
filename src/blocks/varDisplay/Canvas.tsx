import type { CanvasRendererProps } from '../blockApi';
import type { VarDisplayProps } from '../../schema/types';
import { useProjectStore } from '../../state/projectStore';

// Authoring preview: resolve the reference against variable defaults so the
// canvas shows a plausible value; built-ins get a representative sample.
const BUILTIN_SAMPLES: Record<string, string> = {
  Score: '80', ScorePercent: '80', ProgressPercent: '50',
  SlideNumber: '1', CurrentSlide: '1', TotalSlides: '6',
  ViewedSlides: '3', SlideName: 'Slide', CourseName: 'Course',
  ProjectName: 'Course', Date: '1/1/2026', Time: '12:00', RandomNumber: '42'
};

export function VarDisplayCanvas({ block }: CanvasRendererProps) {
  const props = block.props as VarDisplayProps;
  const variables = useProjectStore((s) => s.project.variables);
  const v = variables.find((vr) => vr.name === props.reference);
  const value = v ? String(v.defaultValue) : BUILTIN_SAMPLES[props.reference] ?? `%${props.reference}%`;
  return (
    <div className={`vd-block ${props.tile ? 'tile' : ''}`} style={{ textAlign: props.align }}>
      <span className="vd-value" style={{ fontSize: props.fontSize, color: props.color || undefined }}>
        {props.prefix}{value}{props.suffix}
      </span>
      {props.label && <span className="vd-label">{props.label}</span>}
    </div>
  );
}
