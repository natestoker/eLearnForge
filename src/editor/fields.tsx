import { useRef, useState } from 'react';
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
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      className="input"
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function NumberInput(props: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
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
    />
  );
}

export function TextArea(props: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea
      className="input textarea"
      rows={props.rows ?? 4}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function SelectInput(props: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="input" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function CheckboxInput(props: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
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


export function ColorInput(props: { value: string; onChange: (v: string) => void }) {
  // Swatch picker plus hex text. The native color popup fires 'input'
  // continuously while you drag; writing every tick back through the store
  // (undo snapshot + full re-render) can lock the popup open on some
  // browsers (notably Edge). So we hold a local value during interaction,
  // preview live via a lightweight callback, and commit ONCE on 'change'
  // (when the popup closes) or on blur of the hex field.
  const hex = /^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : '#888888';
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? props.value;
  const shownHex = /^#[0-9a-fA-F]{6}$/.test(shown) ? shown : hex;

  return (
    <div className="color-input">
      <input
        type="color"
        value={shownHex}
        // Live preview only - do not commit to the store here.
        onInput={(e) => setLocal((e.target as HTMLInputElement).value)}
        // Commit once when the picker closes.
        onChange={(e) => { const v = e.target.value; setLocal(null); props.onChange(v); }}
      />
      <input
        className="input"
        value={shown}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== null) { props.onChange(local); setLocal(null); } }}
        onKeyDown={(e) => { if (e.key === 'Enter' && local !== null) { props.onChange(local); setLocal(null); } }}
        placeholder="#3ddc97"
      />
    </div>
  );
}
