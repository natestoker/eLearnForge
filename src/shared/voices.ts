import { useEffect, useState } from 'react';

// Shared voice handling, matching the PPTX Narrator: English voices sorted
// Neural > Google > Microsoft, with cleaned display names. Used by both the
// runtime player controls and the editor bake panel.

export function niceVoiceName(v: SpeechSynthesisVoice): string {
  let n = v.name
    .replace('Microsoft ', '')
    .replace(' - English (United States)', ' (US)')
    .replace(' - English (United Kingdom)', ' (UK)');
  if (n.includes('Online (Natural)')) n = n.replace(' Online (Natural)', ' (Neural)');
  else if (v.name.includes('Google')) n = n.replace(' US English', ' (US)').replace(' UK English', ' (UK)');
  return n;
}

export function sortedVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const score = (v: SpeechSynthesisVoice) => {
    if (v.name.includes('Online (Natural)') || v.name.includes('Neural')) return 3;
    if (v.name.includes('Google')) return 2;
    if (v.name.includes('Microsoft')) return 1;
    return 0;
  };
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('en'))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(sortedVoices);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(sortedVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}
