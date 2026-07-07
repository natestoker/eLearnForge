import type { PropertiesRendererProps } from '../blockApi';
import type { ProgressProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, SelectInput } from '../../editor/fields';
import { useProjectStore } from '../../state/projectStore';

export function ProgressProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as ProgressProps;
  const variables = useProjectStore((s) => s.project.variables).filter((v) => v.type === 'number');
  return (
    <>
      <Field label="Shape">
        <SelectInput
          value={props.shape}
          options={[{ value: 'bar', label: 'Bar' }, { value: 'ring', label: 'Ring' }]}
          onChange={(v) => onUpdateProps((p: ProgressProps) => { p.shape = v as ProgressProps['shape']; })}
        />
      </Field>
      <Field label="Driven by">
        <SelectInput
          value={props.source}
          options={[{ value: 'course', label: 'Course progress (viewed slides)' }, { value: 'variable', label: 'A number variable (0-100)' }]}
          onChange={(v) => onUpdateProps((p: ProgressProps) => { p.source = v as ProgressProps['source']; })}
        />
      </Field>
      {props.source === 'variable' && (
        <Field label="Variable (0-100)">
          <SelectInput
            value={props.variableId ?? ''}
            options={[{ value: '', label: variables.length ? 'Choose…' : 'No number variables' }, ...variables.map((v) => ({ value: v.id, label: v.name }))]}
            onChange={(v) => onUpdateProps((p: ProgressProps) => { p.variableId = v || undefined; })}
          />
        </Field>
      )}
      <Field label="Color">
        <ColorInput value={props.color ?? '#3ddc97'} onChange={(v) => onUpdateProps((p: ProgressProps) => { p.color = v; })} />
      </Field>
      <CheckboxInput label="Show percentage label" checked={props.showLabel} onChange={(v) => onUpdateProps((p: ProgressProps) => { p.showLabel = v; })} />
    </>
  );
}
