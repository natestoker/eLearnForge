import type { PropertiesRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, RangeInput, Row, SelectInput, TextArea } from '../../editor/fields';
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

  // Whole-block semantic tag: reflect and set the element wrapping the text.
  // (For finer control, the in-place editor's Style dropdown tags per
  // paragraph.) A value of '' means plain content (no wrapping heading/p).
  const outerMatch = html.trim().match(/^<(h[1-6]|p)>([\s\S]*)<\/\1>$/i);
  const outerTag = outerMatch ? outerMatch[1].toLowerCase() : '';
  const setOuterTag = (tag: string) => onUpdateProps((p: TextProps) => {
    const m = p.html.trim().match(/^<(h[1-6]|p)>([\s\S]*)<\/\1>$/i);
    const inner = m ? m[2] : p.html;
    p.html = tag ? `<${tag}>${inner}</${tag}>` : inner;
  });

  return (
    <>
      <Field label="Content (HTML allowed)">
        <TextArea
          value={props.html}
          rows={6}
          onChange={(v) => onUpdateProps((p: TextProps) => { p.html = v; })}
        />
      </Field>
      <Field label="Text style (whole block)">
        <SelectInput
          value={outerTag}
          options={[
            { value: '', label: 'Normal text' },
            { value: 'p', label: 'Paragraph' },
            { value: 'h1', label: 'Heading 1' },
            { value: 'h2', label: 'Heading 2' },
            { value: 'h3', label: 'Heading 3' },
            { value: 'h4', label: 'Heading 4' },
            { value: 'h5', label: 'Heading 5' },
            { value: 'h6', label: 'Heading 6' }
          ]}
          onChange={setOuterTag}
        />
      </Field>
      <SavedTextStyles blockId={block.id} currentTag={outerTag} />
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
      <span className="field-label">Margins — space inside the box (px)</span>
      <InsetEditor props={props} onUpdateProps={onUpdateProps} />
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

// Per-side internal margins (padding between the box edge and the text).
function InsetEditor({ props, onUpdateProps }: {
  props: TextProps;
  onUpdateProps: (fn: (p: TextProps) => void, history?: boolean) => void;
}) {
  const set = (side: 'top' | 'right' | 'bottom' | 'left', v: number) =>
    onUpdateProps((p: TextProps) => {
      const inset = { ...(p.inset ?? {}) };
      if (v) inset[side] = v; else delete inset[side];
      p.inset = Object.keys(inset).length ? inset : undefined;
    });
  const val = (side: 'top' | 'right' | 'bottom' | 'left') => props.inset?.[side] ?? 0;
  return (
    <>
      <Row>
        <Field label="Top"><NumberInput value={val('top')} min={0} onChange={(v) => set('top', Math.max(0, v))} /></Field>
        <Field label="Bottom"><NumberInput value={val('bottom')} min={0} onChange={(v) => set('bottom', Math.max(0, v))} /></Field>
      </Row>
      <Row>
        <Field label="Left"><NumberInput value={val('left')} min={0} onChange={(v) => set('left', Math.max(0, v))} /></Field>
        <Field label="Right"><NumberInput value={val('right')} min={0} onChange={(v) => set('right', Math.max(0, v))} /></Field>
      </Row>
    </>
  );
}

const TAG_LABEL: Record<string, string> = {
  '': 'Normal text', p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2',
  h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6'
};

// Reusable named text styles: save this block's look, then apply it to any
// other text block (applies to the whole selection). Stored on the project so
// they travel with the file.
function SavedTextStyles({ blockId, currentTag }: { blockId: string; currentTag: string }) {
  const styles = useProjectStore((s) => s.project.textStyles) ?? [];
  const saveTextStyle = useProjectStore((s) => s.saveTextStyle);
  const applyTextStyle = useProjectStore((s) => s.applyTextStyle);
  const deleteTextStyle = useProjectStore((s) => s.deleteTextStyle);
  const save = () => {
    const suggested = TAG_LABEL[currentTag] ?? 'Text style';
    const name = window.prompt('Name this text style', suggested);
    if (name && name.trim()) saveTextStyle(name.trim(), blockId);
  };
  return (
    <div className="mini-card">
      <span className="field-label">Saved text styles</span>
      {styles.length === 0 && <p className="hint" style={{ margin: '4px 0' }}>Save this block's look, then apply it to other text.</p>}
      {styles.map((s) => (
        <div key={s.id} className="field-row" style={{ marginTop: 4 }}>
          <button className="btn" style={{ flex: 1, textAlign: 'left' }} title="Apply to every selected text block" onClick={() => applyTextStyle(s.id)}>
            {s.name}
          </button>
          <button className="btn btn-ghost btn-icon btn-danger" title="Delete style" onClick={() => deleteTextStyle(s.id)}>x</button>
        </div>
      ))}
      <button className="btn btn-accent" style={{ marginTop: 6, width: '100%' }} onClick={save}>+ Save this look as a style</button>
    </div>
  );
}
