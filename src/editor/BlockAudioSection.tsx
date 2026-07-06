import { useState } from 'react';
import type { Block, TextProps } from '../schema/types';
import { useProjectStore } from '../state/projectStore';
import { ImagePicker } from './fields';
import { AudioBaker } from './AudioBaker';

// Block-attached audio: exactly two ways in. "Add audio" attaches an
// existing file; "Bake audio" synthesizes the element's text with Kokoro
// and attaches the resulting MP3. Playback is the player's normal
// file-based pipeline either way.

// What the element would say when baked (tags stripped, entities decoded).
function spokenTextFor(block: Block): string {
  if (block.type === 'text') {
    const el = document.createElement('div');
    el.innerHTML = (block.props as TextProps).html ?? '';
    return (el.textContent ?? '').trim();
  }
  return '';
}

export function BlockAudioSection({ block }: { block: Block }) {
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const [mode, setMode] = useState<'add' | 'bake' | null>(null);
  const src = block.audio?.src ?? '';
  const setSrc = (v: string) => updateBlock(block.id, (b) => { b.audio = v ? { src: v } : undefined; });

  return (
    <>
      {src ? (
        <>
          <audio src={src} controls style={{ width: '100%' }} />
          <button className="btn btn-ghost" onClick={() => { setSrc(''); setMode(null); }}>Remove audio</button>
        </>
      ) : (
        <p className="hint">No audio attached. Attach a file, or bake this element&apos;s text to speech.</p>
      )}
      <div className="field-row">
        <button className={`btn ${mode === 'add' ? 'btn-accent' : ''}`} onClick={() => setMode(mode === 'add' ? null : 'add')}>
          Add audio
        </button>
        <button className={`btn ${mode === 'bake' ? 'btn-accent' : ''}`} onClick={() => setMode(mode === 'bake' ? null : 'bake')}>
          Bake audio
        </button>
      </div>
      {mode === 'add' && (
        <ImagePicker accept="audio/*" src={src} onChange={setSrc} />
      )}
      {mode === 'bake' && (
        <AudioBaker
          text={spokenTextFor(block)}
          bakeLabel="Bake audio"
          emptyHint="This element has no text to speak."
          onBaked={(r) => setSrc(r.dataUrl)}
        />
      )}
      <p className="hint">
        Attached audio plays when the element appears; on a timeline it starts
        with the element&apos;s bar and follows seeks. Play/pause audio triggers
        target it too.
      </p>
    </>
  );
}
