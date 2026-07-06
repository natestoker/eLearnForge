import type { PropertiesRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, SelectInput, TextArea } from '../../editor/fields';
import { GOOGLE_FONTS, SYSTEM_FONTS, ensureFont } from '../../shared/fonts';
import { useProjectStore } from '../../state/projectStore';

const warningStyle = { color: '#d97706', fontSize: '11px', marginTop: '4px', fontStyle: 'italic', display: 'block' };

export function TextProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as TextProps;
  const mutate = useProjectStore((s) => s.mutate);
  
  const html = props.html || '';
  const overridesFontFamily = /font-family:|face=/i.test(html);
  const overridesFontSize = /font-size:|size=/i.test(html);
  const overridesColor = /color[:=]/i.test(html);
  const overridesBold = /font-weight:\s*bold|<strong>|<b>/i.test(html);

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
          disabled={overridesFontFamily}
          options={[
            { value: '', label: 'JetBrains Mono (default)' },
            ...SYSTEM_FONTS.map((f) => ({ value: f.family, label: `${f.family} (System)` })),
            ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: `${f.family} (${f.category})` }))
          ]}
          onChange={(v) => {
            if (v) { ensureFont(v); mutate((p) => { p.fonts = [...new Set([...(p.fonts ?? []), v])]; }); }
            onUpdateProps((p: TextProps) => { p.fontFamily = v || undefined; });
          }}
        />
        {overridesFontFamily && (
          <span style={warningStyle}>⚠ Controlled by inline HTML styling</span>
        )}
      </Field>
      <Field label="Font size">
        <NumberInput
          value={props.fontSize}
          min={8}
          max={160}
          disabled={overridesFontSize}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.fontSize = v; })}
        />
        {overridesFontSize && (
          <span style={warningStyle}>⚠ Controlled by inline HTML styling</span>
        )}
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
        <ColorInput
          value={props.color ?? '#1c222b'}
          disabled={overridesColor}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.color = v; })}
        />
        {overridesColor && (
          <span style={warningStyle}>⚠ Controlled by inline HTML styling</span>
        )}
      </Field>
      <div style={{ position: 'relative' }}>
        <CheckboxInput
          label="Bold"
          checked={props.bold ?? false}
          disabled={overridesBold}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.bold = v; })}
        />
        {overridesBold && (
          <span style={{ ...warningStyle, marginTop: '2px', paddingLeft: '22px' }}>⚠ Controlled by inline HTML styling</span>
        )}
      </div>
      <CheckboxInput label="Scroll overflow (show scrollbar when text is too tall)" checked={props.scroll ?? false} onChange={(v) => onUpdateProps((p: TextProps) => { p.scroll = v || undefined; })} />
    </>
  );
}
