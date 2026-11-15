// The icon and word at the top of quiz feedback, so right and wrong are never
// told apart by color alone (WCAG 1.4.1). Inline SVG: the published player
// stays one file with no icon font.
export function FeedbackMark({ correct }: { correct: boolean }) {
  return (
    <strong className={`fb-mark ${correct ? 'correct' : 'incorrect'}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        {correct ? <path d="m8.5 12.5 2.5 2.5 4.5-5" /> : <><path d="m9 9 6 6" /><path d="m15 9-6 6" /></>}
      </svg>
      {correct ? 'Correct' : 'Not quite'}
    </strong>
  );
}
