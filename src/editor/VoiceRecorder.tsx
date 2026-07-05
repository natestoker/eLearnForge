import { useEffect, useRef, useState } from 'react';

// Native narration recording: getUserMedia -> MediaRecorder -> data URL.
// The result lands wherever the caller points it (slide narrationSrc or an
// audio block's src), traveling inside the published single file like any
// other embedded media.

export function VoiceRecorder({ onRecorded }: { onRecorded: (dataUrl: string, seconds: number) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => () => {
    // Unmount during a take: stop cleanly and release the mic.
    if (recRef.current?.state === 'recording') recRef.current.stop();
    window.clearInterval(timerRef.current);
  }, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const seconds = (performance.now() - startedRef.current) / 1000;
        const reader = new FileReader();
        reader.onload = () => onRecorded(String(reader.result), seconds);
        reader.readAsDataURL(blob);
      };
      rec.start();
      recRef.current = rec;
      startedRef.current = performance.now();
      setElapsed(0);
      timerRef.current = window.setInterval(
        () => setElapsed((performance.now() - startedRef.current) / 1000),
        200
      );
      setState('recording');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone unavailable.');
      setState('error');
    }
  };

  const stop = () => {
    window.clearInterval(timerRef.current);
    recRef.current?.stop();
    setState('idle');
  };

  return (
    <div className="voice-recorder">
      {state !== 'recording' ? (
        <button className="btn" onClick={start}>Record narration (mic)</button>
      ) : (
        <button className="btn btn-danger-solid rec-live" onClick={stop}>
          Stop - {elapsed.toFixed(1)}s
        </button>
      )}
      {state === 'error' && <p className="hint publish-warning">{error}</p>}
    </div>
  );
}
