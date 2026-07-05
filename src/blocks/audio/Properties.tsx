import type { PropertiesRendererProps } from '../blockApi';
import type { AudioProps } from '../../schema/types';
import { CheckboxInput, Field, ImagePicker, TextInput } from '../../editor/fields';
import { VoiceRecorder } from '../../editor/VoiceRecorder';

export function AudioProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as AudioProps;
  const timed = Boolean(block.timing);
  return (
    <>
      <Field label="Label (shown on the canvas and timeline)">
        <TextInput value={props.label ?? ''} placeholder="Audio" onChange={(v) => onUpdateProps((p: AudioProps) => { p.label = v || undefined; })} />
      </Field>
      <Field label="Source (URL or upload)">
        <ImagePicker accept="audio/*" src={props.src} onChange={(v) => onUpdateProps((p: AudioProps) => { p.src = v; })} />
      </Field>
      <VoiceRecorder onRecorded={(dataUrl) => onUpdateProps((p: AudioProps) => { p.src = dataUrl; })} />
      <CheckboxInput
        label="Hidden in player (narration track)"
        checked={props.hideInPlayer ?? false}
        onChange={(v) => onUpdateProps((p: AudioProps) => { p.hideInPlayer = v || undefined; })}
      />
      {!props.hideInPlayer && (
        <CheckboxInput label="Show controls" checked={props.controls} onChange={(v) => onUpdateProps((p: AudioProps) => { p.controls = v; })} />
      )}
      {timed ? (
        <p className="hint">On the timeline this plays automatically when its bar is reached, follows the seekbar, and pauses with the slide - like any timed object. Drag its bar to set when it starts.</p>
      ) : (
        <CheckboxInput label="Autoplay" checked={props.autoplay} onChange={(v) => onUpdateProps((p: AudioProps) => { p.autoplay = v; })} />
      )}
    </>
  );
}
