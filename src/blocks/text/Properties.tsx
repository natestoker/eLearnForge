import type { PropertiesRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, RangeInput, SelectInput, TextArea } from '../../editor/fields';
import { GOOGLE_FONTS, SYSTEM_FONTS, ensureFont } from '../../shared/fonts';
import { useProjectStore } from '../../state/projectStore';

const warningStyle = { color: '#d97706', fontSize: '11px', marginTop: '4px', fontStyle: 'italic', display: 'block' };

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black'
};

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
      <Field label="Line height">
        <NumberInput
          value={props.lineHeight ?? 1.35}
          min={0.8}
          max={3}
          step={0.05}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.lineHeight = Math.abs(v - 1.35) < 0.001 ? undefined : v; })}
        />
      </Field>
      <Field label="Letter spacing (px)">
        <NumberInput
          value={props.letterSpacing ?? 0}
          min={-5}
          max={40}
          step={0.5}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.letterSpacing = v ? v : undefined; })}
        />
      </Field>
      <button
        className="btn btn-ghost"
        title="Strip all inline HTML formatting, keeping just the words (so the panel's font/size/color take over)"
        onClick={() => onUpdateProps((p: TextProps) => {
          const tmp = document.createElement('div');
          tmp.innerHTML = p.html;
          // Keep paragraph breaks: block elements -> newlines, then text only.
          tmp.querySelectorAll('div,p,br').forEach((el) => el.replaceWith('\n' + (el.textContent ?? '')));
          const text = (tmp.textContent ?? '').replace(/\n{2,}/g, '\n').trim();
          p.html = text.split('\n').map((line) => line ? `<div>${line.replace(/</g, '&lt;')}</div>` : '<div><br/></div>').join('');
        })}
      >
        Clear formatting (HTML)
      </button>
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
      <Field label="Weight">
        <RangeInput
          value={props.fontWeight ?? (props.bold ? 700 : 400)}
          min={100}
          max={900}
          step={100}
          disabled={overridesBold}
          format={(v) => `${v}${WEIGHT_NAMES[v] ? ` · ${WEIGHT_NAMES[v]}` : ''}`}
          onChange={(v) => onUpdateProps((p: TextProps) => {
            // Store an explicit weight; keep `bold` in sync for any legacy
            // consumer and so 700 still reads as "bold".
            p.fontWeight = v === 400 ? undefined : v;
            p.bold = v >= 700 ? true : undefined;
          })}
        />
        {overridesBold && (
          <span style={warningStyle}>⚠ Controlled by inline HTML styling</span>
        )}
      </Field>
      <CheckboxInput label="Scroll overflow (show scrollbar when text is too tall)" checked={props.scroll ?? false} onChange={(v) => onUpdateProps((p: TextProps) => { p.scroll = v || undefined; })} />
    </>
  );
}
