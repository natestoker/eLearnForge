import type { PropertiesRendererProps } from '../blockApi';
import type { HotspotProps } from '../../schema/types';
import { CheckboxInput, Field, TextInput } from '../../editor/fields';

export function HotspotProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as HotspotProps;
  return (
    <>
      <Field label="Tooltip (optional)">
        <TextInput value={props.tooltip} onChange={(v) => onUpdateProps((p: HotspotProps) => { p.tooltip = v; })} />
      </Field>
      <CheckboxInput
        label="Show a subtle pulse hint at runtime"
        checked={props.showHint}
        onChange={(v) => onUpdateProps((p: HotspotProps) => { p.showHint = v; })}
      />
      <p className="hint">Invisible at runtime. Pair it with an On click trigger to reveal layers or set variables.</p>
    </>
  );
}
