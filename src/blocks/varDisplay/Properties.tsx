import type { PropertiesRendererProps } from '../blockApi';
import type { VarDisplayProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, SelectInput, TextInput } from '../../editor/fields';
import { useProjectStore } from '../../state/projectStore';

const BUILTINS = [
  { value: 'Score', label: 'Score (built-in)' },
  { value: 'ProgressPercent', label: 'Progress % (built-in)' },
  { value: 'SlideNumber', label: 'Slide number (built-in)' },
  { value: 'TotalSlides', label: 'Total slides (built-in)' },
  { value: 'ViewedSlides', label: 'Viewed slides (built-in)' },
  { value: 'CourseName', label: 'Course name (built-in)' }
];

export function VarDisplayProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as VarDisplayProps;
  const variables = useProjectStore((s) => s.project.variables);
  const options = [
    ...BUILTINS,
    ...variables.map((v) => ({ value: v.name, label: v.name }))
  ];
  // A reference typed by hand (or from a deleted variable) still shows up.
  if (!options.some((o) => o.value === props.reference)) {
    options.push({ value: props.reference, label: props.reference });
  }
  return (
    <>
      <Field label="Show">
        <SelectInput
          value={props.reference}
          options={options}
          onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.reference = v; })}
        />
      </Field>
      <Field label="Caption">
        <TextInput value={props.label} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.label = v; })} />
      </Field>
      <Field label="Prefix">
        <TextInput value={props.prefix ?? ''} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.prefix = v || undefined; })} />
      </Field>
      <Field label="Suffix">
        <TextInput value={props.suffix ?? ''} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.suffix = v || undefined; })} />
      </Field>
      <Field label="Value size">
        <NumberInput value={props.fontSize} min={14} max={160} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.fontSize = v; })} />
      </Field>
      <Field label="Align">
        <SelectInput
          value={props.align}
          options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
          onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.align = v as VarDisplayProps['align']; })}
        />
      </Field>
      <Field label="Value color">
        <ColorInput value={props.color ?? '#1fa871'} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.color = v; })} />
      </Field>
      <CheckboxInput label="Card style (border + background)" checked={props.tile} onChange={(v) => onUpdateProps((p: VarDisplayProps) => { p.tile = v; })} />
      <p className="hint">Updates live as the value changes. Text blocks can also embed references inline with <code>%Name%</code>.</p>
    </>
  );
}
