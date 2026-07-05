import type { PropertiesRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';
import { CheckboxInput, Field, ImagePicker } from '../../editor/fields';

export function VideoProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as VideoProps;
  return (
    <>
      <Field label="Source (URL or upload)">
        <ImagePicker accept="video/*" src={props.src} onChange={(v) => onUpdateProps((p: VideoProps) => { p.src = v; })} />
      </Field>
      <CheckboxInput label="Show controls" checked={props.controls} onChange={(v) => onUpdateProps((p: VideoProps) => { p.controls = v; })} />
      <CheckboxInput label="Autoplay (muted)" checked={props.autoplay} onChange={(v) => onUpdateProps((p: VideoProps) => { p.autoplay = v; })} />
      <CheckboxInput label="Loop" checked={props.loop} onChange={(v) => onUpdateProps((p: VideoProps) => { p.loop = v; })} />
      <p className="hint">Uploads embed as data URLs and travel inside the published file. Keep them short or host larger video and paste the URL.</p>
    </>
  );
}
