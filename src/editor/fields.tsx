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
  const hex = /^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : '#888888';
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? props.value;
  
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValue = useRef<string | null>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = hex;
    }
  }, [hex]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    
    let debounceTimeout: any = null;

    const commitValue = (v: string) => {
      lastCommittedValue.current = v;
      props.onChange(v);
    };

    const handleInput = (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      setLocal(v);
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        commitValue(v);
      }, 100); // 100ms debounce prevents rendering storms during eyedropper dragging
    };

    const handleChange = (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      setLocal(null);
      commitValue(v);
    };

    el.addEventListener('input', handleInput);
    el.addEventListener('change', handleChange);
    
    return () => {
      el.removeEventListener('input', handleInput);
      el.removeEventListener('change', handleChange);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [props.onChange]);

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const activateEyeDropper = async () => {
    try {
      const picker = new (window as any).EyeDropper();
      const result = await picker.open();
      if (result.sRGBHex) {
        lastCommittedValue.current = result.sRGBHex;
        setLocal(null);
        if (inputRef.current) {
          inputRef.current.value = result.sRGBHex;
        }
        props.onChange(result.sRGBHex);
      }
    } catch (err) {
      console.log('EyeDropper closed or failed:', err);
    }
  };

  return (
    <div className={`color-input ${props.disabled ? 'disabled' : ''}`}>
      <input
        ref={inputRef}
        type="color"
        defaultValue={hex}
        disabled={props.disabled}
      />
      {hasEyeDropper && (
        <button
          type="button"
          className="eyedropper-btn"
          disabled={props.disabled}
          onClick={activateEyeDropper}
          title="Pick color from screen"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'inherit',
            opacity: props.disabled ? 0.4 : 0.7,
            height: '100%'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 22 1-1" />
            <path d="M14 6 8 12v3h3l6-6-3-3Z" />
            <path d="m18 2 4 4" />
            <path d="m17 3 4 4" />
          </svg>
        </button>
      )}
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
