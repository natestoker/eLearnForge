import type { LabelStyle } from '../schema/types';
import { CheckboxInput, ColorInput, Field, NumberInput, SelectInput } from './fields';
import { GOOGLE_FONTS, SYSTEM_FONTS, ensureFont } from '../shared/fonts';
import { useProjectStore } from '../state/projectStore';

// Font, size, weight, italic and color for a widget's label. `value` is the
// block's labelStyle; `onChange` receives the next one (undefined = reset).
export function LabelStyleFields({
  value, onChange, sizePlaceholder = 15, label = 'Label'
}: { value: LabelStyle | undefined; onChange: (next: LabelStyle | undefined) => void; sizePlaceholder?: number; label?: string }) {
  const mutate = useProjectStore((s) => s.mutate);
  const s = value ?? {};
  const set = (patch: Partial<LabelStyle>) => {
    const next = { ...s, ...patch };
    // Drop empty fields so "reset" really returns to the default.
    (Object.keys(next) as Array<keyof LabelStyle>).forEach((k) => { if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k]; });
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <>
      <h4 className="panel-subtitle">{label} text</h4>
      <Field label="Font">
        <SelectInput
          value={s.fontFamily ?? ''}
          options={[
            { value: '', label: 'Default' },
            ...SYSTEM_FONTS.map((f) => ({ value: f.family, label: `${f.family} (System)` })),
            ...GOOGLE_FONTS.map((f) => ({ value: f.family, label: `${f.family} (${f.category})` }))
          ]}
          onChange={(v) => {
            if (v) { ensureFont(v); mutate((p) => { p.fonts = [...new Set([...(p.fonts ?? []), v])]; }); }
            set({ fontFamily: v || undefined });
          }}
        />
      </Field>
      <Field label="Size (px)">
        <NumberInput value={s.fontSize ?? sizePlaceholder} min={8} max={96} onChange={(v) => set({ fontSize: v === sizePlaceholder ? undefined : v })} />
      </Field>
      <Field label="Weight">
        <SelectInput
          value={String(s.fontWeight ?? '')}
          options={[
            { value: '', label: 'Default' }, { value: '400', label: 'Regular' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' }, { value: '800', label: 'Extra bold' }
          ]}
          onChange={(v) => set({ fontWeight: v ? Number(v) : undefined })}
        />
      </Field>
      <CheckboxInput label="Italic" checked={!!s.italic} onChange={(v) => set({ italic: v })} />
      <Field label="Color">
        <ColorInput value={s.color ?? '#1c211d'} onChange={(v) => set({ color: v })} />
      </Field>
      {value && <button className="btn btn-ghost" onClick={() => onChange(undefined)}>Reset text style</button>}
    </>
  );
}
