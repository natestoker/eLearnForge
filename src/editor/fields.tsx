import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useProjectStore } from '../state/projectStore';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

// A field whose content contains buttons (pickers, grids). Rendered as a
// <div>, NOT a <label>: the browser forwards clicks on a label's
// non-interactive area to its first labelable descendant - with a button
// grid inside, any stray click (tile gaps, the caption, the click that
// closes a native color popup) would silently "press" the first tile.
export function ButtonField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
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

// A slider with a live numeric readout. Used where a value lives on a
// continuous scale (font weight, opacity) and a spinner would be fiddlier
// than dragging. `format` labels the current value.
export function RangeInput(props: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; disabled?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div className="range-input">
      <input
        className="range-slider"
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <span className="range-value">{props.format ? props.format(props.value) : props.value}</span>
    </div>
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
  // or moves the eyedropper. Three rules keep that safe AND live:
  //
  // 1. One undo step per interaction. React's synthetic onChange on
  //    <input type="color"> is an alias for 'input', so a naive
  //    onChange={commit} pushes a full-project history snapshot (two deep
  //    clones of a document that embeds data-URL media) on EVERY tick of
  //    an eyedropper drag - that render/clone storm is what froze and
  //    crashed the tab. Instead the first tick opens a store gesture
  //    (records once, then suppresses record()), live ticks commit
  //    throttled and history-free, and the NATIVE 'change' event (fires
  //    once, when the popup closes or the eyedropper picks) commits the
  //    final value and closes the gesture.
  // 2. Live ticks are throttled (~90ms) so the canvas previews the fill in
  //    real time without cloning the project at pointer-move rate.
  // 3. Never write to the input element while its picker is open. The
  //    element is uncontrolled; external value changes sync through a ref
  //    only between interactions.
  const hex = /^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : '#888888';
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? props.value;

  // Brand palette (PowerPoint "theme colors"): the course accent plus any
  // custom brand colours, offered as one-click swatches in every colour
  // picker. Managed on the Home ribbon.
  const theme = useProjectStore((s) => s.project.theme);
  const swatches = useMemo(
    () => [...new Set([theme?.accent, ...(theme?.palette ?? [])].filter(Boolean) as string[])],
    [theme]
  );

  const colorRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const inGesture = useRef(false);
  const lastLiveCommit = useRef(0);

  const liveTick = (v: string) => {
    if (!inGesture.current) {
      inGesture.current = true;
      useProjectStore.getState().beginGesture();
    }
    const now = performance.now();
    if (now - lastLiveCommit.current > 90) {
      lastLiveCommit.current = now;
      // The gesture suppresses the caller's record(), so this repaints the
      // canvas without growing undo history.
      onChangeRef.current(v);
    }
  };

  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const onNativeChange = () => {
      setLocal(null);
      onChangeRef.current(el.value);
      if (inGesture.current) {
        inGesture.current = false;
        useProjectStore.getState().endGesture();
      }
    };
    el.addEventListener('change', onNativeChange);
    return () => {
      el.removeEventListener('change', onNativeChange);
      // Unmount mid-interaction: never leave record() suppressed.
      if (inGesture.current) {
        inGesture.current = false;
        useProjectStore.getState().endGesture();
      }
    };
  }, []);

  // Sync external value changes (undo, another field) into the swatch,
  // but only while no interaction is in flight.
  useEffect(() => {
    const el = colorRef.current;
    if (el && local === null && el.value !== hex) el.value = hex;
  }, [hex, local]);

  return (
    <div className="color-field">
      <div className={`color-input ${props.disabled ? 'disabled' : ''}`}>
        <input
          ref={colorRef}
          type="color"
          defaultValue={hex}
          disabled={props.disabled}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            setLocal(v);
            liveTick(v);
          }}
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
      {!props.disabled && swatches.length > 0 && (
        <div className="brand-swatches" role="group" aria-label="Brand colors">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              className={`brand-swatch ${shown.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
              style={{ background: c }}
              title={`Brand color ${c}`}
              onClick={() => { setLocal(null); props.onChange(c); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
