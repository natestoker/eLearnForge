import type { PropertiesRendererProps } from '../blockApi';
import type { TabsProps } from '../../schema/types';
import { ColorInput, Field, NumberInput, SelectInput, TextArea, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function TabsProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as TabsProps;
  return (
    <>
      <Field label="Layout">
        <SelectInput
          value={props.layout}
          options={[{ value: 'tabs', label: 'Tabs' }, { value: 'accordion', label: 'Accordion' }]}
          onChange={(v) => onUpdateProps((p: TabsProps) => { p.layout = v as TabsProps['layout']; })}
        />
      </Field>
      <Field label="Font size">
        <NumberInput value={props.fontSize} min={10} max={48} onChange={(v) => onUpdateProps((p: TabsProps) => { p.fontSize = v; })} />
      </Field>
      <Field label="Accent">
        <ColorInput value={props.accent ?? '#3ddc97'} onChange={(v) => onUpdateProps((p: TabsProps) => { p.accent = v; })} />
      </Field>

      <h4 className="panel-subtitle">Panels</h4>
      {props.panels.map((panel, i) => (
        <div key={panel.id} className="tabs-panel-edit">
          <div className="field-row">
            <TextInput value={panel.label} onChange={(v) => onUpdateProps((p: TabsProps) => { p.panels[i].label = v; })} />
            <button
              className="btn btn-ghost btn-icon btn-danger"
              title="Delete panel"
              disabled={props.panels.length <= 1}
              onClick={() => onUpdateProps((p: TabsProps) => { p.panels.splice(i, 1); })}
            >x</button>
          </div>
          <TextArea value={panel.html} rows={3} onChange={(v) => onUpdateProps((p: TabsProps) => { p.panels[i].html = v; })} />
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: TabsProps) => { p.panels.push({ id: uid('tab'), label: `Tab ${p.panels.length + 1}`, html: '<p>New panel.</p>' }); })}>+ Panel</button>
    </>
  );
}
