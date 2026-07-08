import type { PropertiesRendererProps } from '../blockApi';
import type { VideoProps } from '../../schema/types';
import { CheckboxInput, Field, ImagePicker, TextArea, TextInput } from '../../editor/fields';

export function VideoProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as VideoProps;

  // Read an uploaded .vtt/.srt file as text and store it. SRT is converted to
  // VTT (comma decimal separators -> dots, plus the WEBVTT header) so authors
  // can drop in either format.
  const onCaptionFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = String(reader.result);
      if (/\.srt$/i.test(file.name) || !/^WEBVTT/.test(text.trim())) {
        text = srtToVtt(text);
      }
      onUpdateProps((p: VideoProps) => { p.captionsVtt = text; });
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Field label="Source (URL or upload)">
        <ImagePicker accept="video/*" src={props.src} onChange={(v) => onUpdateProps((p: VideoProps) => { p.src = v; })} />
      </Field>
      <Field label="Poster image (shown before play)">
        <ImagePicker accept="image/*" src={props.poster ?? ''} onChange={(v) => onUpdateProps((p: VideoProps) => { p.poster = v || undefined; })} />
      </Field>
      <CheckboxInput label="Show controls" checked={props.controls} onChange={(v) => onUpdateProps((p: VideoProps) => { p.controls = v; })} />
      <CheckboxInput label="Autoplay (muted)" checked={props.autoplay} onChange={(v) => onUpdateProps((p: VideoProps) => { p.autoplay = v; })} />
      <CheckboxInput label="Loop" checked={props.loop} onChange={(v) => onUpdateProps((p: VideoProps) => { p.loop = v; })} />

      <div className="divider" />
      <h4 className="panel-subtitle">Captions (WebVTT)</h4>
      <label className="field">
        <span className="field-label">Upload .vtt or .srt</span>
        <input
          className="input"
          type="file"
          accept=".vtt,.srt,text/vtt"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onCaptionFile(f); e.target.value = ''; }}
        />
      </label>
      <Field label="…or paste caption cues">
        <TextArea
          value={props.captionsVtt ?? ''}
          rows={5}
          placeholder={'WEBVTT\n\n00:00.000 --> 00:03.000\nWelcome to the course.'}
          onChange={(v) => onUpdateProps((p: VideoProps) => { p.captionsVtt = v || undefined; })}
        />
      </Field>
      {props.captionsVtt && (
        <div className="field-row">
          <Field label="Label">
            <TextInput value={props.captionsLabel ?? ''} placeholder="English" onChange={(v) => onUpdateProps((p: VideoProps) => { p.captionsLabel = v || undefined; })} />
          </Field>
          <Field label="Language">
            <TextInput value={props.captionsLang ?? ''} placeholder="en" onChange={(v) => onUpdateProps((p: VideoProps) => { p.captionsLang = v || undefined; })} />
          </Field>
        </div>
      )}
      <p className="hint">Uploads embed inside the published file. Keep video short or host it and paste the URL. Captions need controls on (the CC button toggles them).</p>
    </>
  );
}

// Minimal SRT -> WebVTT: strip the numeric counters, swap the comma in
// timestamps for a dot, and prepend the required signature.
function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^\s*\d+\s*$/gm, '')                       // sequence numbers
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')   // , -> . in timecodes
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `WEBVTT\n\n${body}\n`;
}
