import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

export function TextInput(props: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      className="input"
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    />
  );
}

export function NumberInput(props: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean;
}) {
  return (
    <input
      className="input input-number"
      type="number"
      value={props.value}
      min={props.min}
      max={props.max}
      step={props.step}
      onChange={(e) => props.onChange(Number(e.target.value))}
      disabled={props.disabled}
    />
  );
}

export function TextArea(props: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; disabled?: boolean;
}) {
  return (
    <textarea
      className="input textarea"
      rows={props.rows ?? 4}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    />
  );
}

export function SelectInput(props: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select className="input" value={props.value} onChange={(e) => props.onChange(e.target.value)} disabled={props.disabled}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function CheckboxInput(props: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <label className={`checkbox ${props.disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        disabled={props.disabled}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function ImagePicker(props: { src: string; onChange: (src: string) => void; accept?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const browse = () => inputRef.current?.click();
  return (
    <div className="image-picker">
      {/* Clicking anywhere on the drop area opens the file dialog. */}
      <button type="button" className="picker-drop" onClick={browse}>
        {props.src
          ? (props.src.startsWith('data:') ? 'Embedded file - click to replace' : 'Click to replace file')
          : 'Click to browse for a file...'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={props.accept ?? 'image/*'}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => props.onChange(String(reader.result));
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />
      <TextInput value={props.src.startsWith('data:') ? '' : props.src} onChange={props.onChange} placeholder="...or paste a URL" />
      {props.src && (
        <button className="btn btn-ghost" onClick={() => props.onChange('')}>Clear</button>
      )}
    </div>
  );
}


export function ColorInput(props: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  // Swatch picker (the browser's native popup, including its built-in
  // eyedropper) plus a hex text field.
  //
  // The picker fires 'input' continuously while the author drags a slider
  // or moves the eyedropper. Two rules keep that safe:
  //
  // 1. Commit ONCE, from the NATIVE 'change' event. React's synthetic
  //    onChange on <input type="color"> is an alias for 'input', so wiring
  //    onChange={commit} pushes a full-project history snapshot (two deep
  //    clones of a document that embeds data-URL media) on EVERY tick of
  //    an eyedropper drag - that render/clone storm is what froze and
  //    crashed the tab. The native 'change' event fires exactly once, when
  //    the popup closes or the eyedropper picks.
  // 2. Never write to the input element while its picker is open. The
  //    element is uncontrolled; external value changes sync through a ref
  //    only between interactions.
  const hex = /^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : '#888888';
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? props.value;

  const colorRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const onNativeChange = () => {
      setLocal(null);
      onChangeRef.current(el.value);
    };
    el.addEventListener('change', onNativeChange);
    return () => el.removeEventListener('change', onNativeChange);
  }, []);

  // Sync external value changes (undo, another field) into the swatch,
  // but only while no interaction is in flight.
  useEffect(() => {
    const el = colorRef.current;
    if (el && local === null && el.value !== hex) el.value = hex;
  }, [hex, local]);

  return (
    <div className={`color-input ${props.disabled ? 'disabled' : ''}`}>
      <input
        ref={colorRef}
        type="color"
        defaultValue={hex}
        disabled={props.disabled}
        onInput={(e) => setLocal((e.target as HTMLInputElement).value)}
      />
      <input
        className="input"
        value={shown}
        disabled={props.disabled}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== null) {
            props.onChange(local);
            setLocal(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && local !== null) {
            props.onChange(local);
            setLocal(null);
          }
        }}
        placeholder="#3ddc97"
      />
    </div>
  );
}
