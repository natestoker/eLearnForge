import type { PropertiesRendererProps } from '../blockApi';
import type { LabeledGraphicProps } from '../../schema/types';
import { Field, ImagePicker, NumberInput, SelectInput, TextInput } from '../../editor/fields';
import { uid } from '../../schema/factory';

export function LabeledGraphicProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as LabeledGraphicProps;
  return (
    <>
      <Field label="Image">
        <ImagePicker src={props.src} onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.src = v; })} />
      </Field>
      <Field label="Fit">
        <SelectInput
          value={props.fit}
          options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }]}
          onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.fit = v as LabeledGraphicProps['fit']; })}
        />
      </Field>

      <h4 className="panel-subtitle">Markers (position in % of the block)</h4>
      {props.markers.map((m, i) => (
        <div key={m.id} className="lg-prop-marker">
          <div className="field-row">
            <span className="seq-prop-num">{i + 1}</span>
            <TextInput value={m.title} onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.markers[i].title = v; })} />
            <NumberInput value={Math.round(m.x)} min={0} max={100} onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.markers[i].x = Math.max(0, Math.min(100, v)); })} />
            <NumberInput value={Math.round(m.y)} min={0} max={100} onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.markers[i].y = Math.max(0, Math.min(100, v)); })} />
            <button className="btn btn-ghost btn-icon btn-danger" title="Delete marker" disabled={props.markers.length <= 1}
              onClick={() => onUpdateProps((p: LabeledGraphicProps) => { p.markers.splice(i, 1); })}>x</button>
          </div>
          <TextInput value={m.body} placeholder="Popup body text"
            onChange={(v) => onUpdateProps((p: LabeledGraphicProps) => { p.markers[i].body = v; })} />
        </div>
      ))}
      <button className="btn" onClick={() => onUpdateProps((p: LabeledGraphicProps) => { p.markers.push({ id: uid('mk'), x: 50, y: 50, title: 'New marker', body: 'Describe this point.' }); })}>+ Marker</button>

      <p className="hint">When every marker has been opened once, sets the boolean <code>lg_{block.id}_done</code> for triggers.</p>
    </>
  );
}
