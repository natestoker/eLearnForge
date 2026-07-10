import { useEffect, useState } from 'react';
import type { RuntimeRendererProps } from '../blockApi';
import type { SliderProps } from '../../schema/types';
import { sliderVariableName } from '../../schema/factory';

// Every change writes slider_{blockId}_value, so triggers can react with
// gt / lt / between conditions ("show the caution layer when risk > 7").
export function SliderRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as SliderProps;
  const [value, setValue] = useState(props.defaultValue);

  useEffect(() => {
    runtime.setVariableByName(sliderVariableName(block.id), props.defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (v: number) => {
    setValue(v);
    runtime.setVariableByName(sliderVariableName(block.id), v);
  };

  return (
    <div className="slider-block live" onClick={(e) => e.stopPropagation()}>
      <div className="slider-head">
        <span className="slider-label">{props.label}</span>
        {props.showValue && <span className="slider-value">{value}</span>}
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={value}
        aria-label={props.label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-scale">
        <span>{props.min}</span>
        <span>{props.max}</span>
      </div>
    </div>
  );
}
