import type { CanvasRendererProps } from '../blockApi';
import type { SliderProps } from '../../schema/types';
import { labelStyleCss } from '../../shared/labelStyle';

export function SliderCanvas({ block }: CanvasRendererProps) {
  const props = block.props as SliderProps;
  return (
    <div className="slider-block" style={{ color: props.labelStyle?.color, fontFamily: labelStyleCss(props.labelStyle).fontFamily }}>
      <div className="slider-head">
        <span className="slider-label" style={labelStyleCss(props.labelStyle)}>{props.label}</span>
        {props.showValue && <span className="slider-value">{props.defaultValue}</span>}
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.defaultValue} readOnly />
    </div>
  );
}
