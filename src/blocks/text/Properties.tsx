import type { PropertiesRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, SelectInput, TextArea } from '../../editor/fields';
import { GOOGLE_FONTS, ensureFont } from '../../shared/fonts';
import { useProjectStore } from '../../state/projectStore';

export function TextProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as TextProps;
  const mutate = useProjectStore((s) => s.mutate);
  return (
    <>
      <Field label="Content (HTML allowed)">
        <TextArea
          value={props.html}
          rows={6}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.html = v; })}
        />
      </Field>
      <Field label="Font">
        <SelectInput
          value={props.fontFamily ?? ''}
          options={[
            { value: '', label: 'JetBrains Mono (default)' },
            ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: `${f.family} (${f.category})` }))
          ]}
          onChange={(v) => {
            if (v) { ensureFont(v); mutate((p) => { p.fonts = [...new Set([...(p.fonts ?? []), v])]; }); }
            onUpdateProps((p: TextProps) => { p.fontFamily = v || undefined; });
          }}
        />
      </Field>
      <Field label="Font size">
        <NumberInput
          value={props.fontSize}
          min={8}
          max={160}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.fontSize = v; })}
        />
      </Field>
      <Field label="Align">
        <SelectInput
          value={props.align}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
          ]}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.align = v as TextProps['align']; })}
        />
      </Field>
      <Field label="Vertical align">
        <SelectInput
          value={props.valign ?? 'top'}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'center', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' }
          ]}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.valign = v as TextProps['valign']; })}
        />
      </Field>
      <Field label="Text animation (plays when it enters)">
        <SelectInput
          value={props.textAnim ?? 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'fadeIn', label: 'Fade in' },
            { value: 'blurIn', label: 'Blur in' },
            { value: 'typewriter', label: 'Typewriter' },
            { value: 'wordsUp', label: 'Words rise' },
            { value: 'lettersUp', label: 'Letters rise' }
          ]}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.textAnim = v as TextProps['textAnim']; })}
        />
      </Field>
      <p className="hint">Tip: double-click the block on the canvas to edit text in place with a formatting toolbar.</p>
      <Field label="Color">
        <ColorInput value={props.color ?? '#1c222b'} onChange={(v) => onUpdateProps((p: TextProps) => { p.color = v; })} />
      </Field>
      <CheckboxInput label="Bold" checked={props.bold ?? false} onChange={(v) => onUpdateProps((p: TextProps) => { p.bold = v; })} />
      <CheckboxInput label="Scroll overflow (show scrollbar when text is too tall)" checked={props.scroll ?? false} onChange={(v) => onUpdateProps((p: TextProps) => { p.scroll = v || undefined; })} />
    </>
  );
}
