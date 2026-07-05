import type { PropertiesRendererProps } from '../blockApi';
import type { CodeProps } from '../../schema/types';
import { Field } from '../../editor/fields';

function CodeArea(props: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      className="input code-area"
      spellCheck={false}
      rows={props.rows ?? 6}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function CodeProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as CodeProps;
  return (
    <>
      <Field label="HTML">
        <CodeArea value={props.html} onChange={(v) => onUpdateProps((p: CodeProps) => { p.html = v; })} />
      </Field>
      <Field label="CSS (scoped to this block)">
        <CodeArea value={props.css} onChange={(v) => onUpdateProps((p: CodeProps) => { p.css = v; })} rows={4} />
      </Field>
      <Field label="JavaScript">
        <CodeArea value={props.js} onChange={(v) => onUpdateProps((p: CodeProps) => { p.js = v; })} rows={8} />
      </Field>
      <p className="hint">
        In scope: <code>root</code> (this block&apos;s element), <code>gsap</code>, and{' '}
        <code>forge</code> with setVariable(name, value), getVariable(name),
        onVariableChange(fn), complete(), goToSlide(n). Runs once when the block
        mounts at runtime; wrapped in an IIFE automatically.
      </p>
    </>
  );
}
