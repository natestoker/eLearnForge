import type { InteractionDetail } from './adapter';

// Turns an InteractionDetail into the wire formats of each protocol.
//
// Option ids on the wire are one base-36 character per option position
// (0-9, a-z). SCORM 1.2 requires single-character identifiers for choice,
// sequencing and matching, and the other protocols accept them, so one
// scheme serves all three. A question with more than 36 options can't be
// expressed that way and is reported as a plain "other" interaction.

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const idOf = (i: number): string => ID_CHARS[i];

export type WireKind = 'choice' | 'fill-in' | 'matching' | 'sequencing' | 'other';

export interface WireInteraction {
  kind: WireKind;
  // Learner response and correct response patterns, in the given syntax.
  response: string;
  correct: string[];
}

function optionCount(d: InteractionDetail): number {
  switch (d.kind) {
    case 'choice': return d.choices.length;
    case 'sequencing': return d.items.length;
    case 'matching': return Math.max(d.sources.length, d.targets.length);
    default: return 0;
  }
}

export function fitsIdScheme(d: InteractionDetail | undefined): boolean {
  return !!d && d.kind !== 'other' && optionCount(d) <= ID_CHARS.length;
}

const sortedIds = (idx: number[]) => [...idx].sort((a, b) => a - b).map(idOf);

// syntax 'scorm12' joins with ',' and '.'; 'delimited' (SCORM 2004 and xAPI)
// joins with '[,]' and '[.]'.
export function toWire(d: InteractionDetail, syntax: 'scorm12' | 'delimited'): WireInteraction | null {
  if (!fitsIdScheme(d)) return null;
  const list = syntax === 'scorm12' ? ',' : '[,]';
  const pair = syntax === 'scorm12' ? '.' : '[.]';
  switch (d.kind) {
    case 'choice':
      return {
        kind: 'choice',
        response: sortedIds(d.learner).join(list),
        correct: [sortedIds(d.correct).join(list)]
      };
    case 'sequencing':
      return {
        kind: 'sequencing',
        response: d.learner.map(idOf).join(list),
        correct: [d.correct.map(idOf).join(list)]
      };
    case 'matching': {
      const fmt = (ps: [number, number][]) => ps.map(([s, t]) => `${idOf(s)}${pair}${idOf(t)}`).join(list);
      return { kind: 'matching', response: fmt(d.learner), correct: [fmt(d.correct)] };
    }
    case 'fill-in': {
      // SCORM 2004 and xAPI carry case sensitivity in the pattern; 1.2
      // patterns are plain strings.
      const prefix = syntax === 'scorm12' ? '' : `{case_matters=${d.caseSensitive ? 'true' : 'false'}}`;
      return {
        kind: 'fill-in',
        response: d.learner,
        correct: d.correct.map((c) => prefix + c)
      };
    }
    default:
      return null;
  }
}

// SCORM 1.2 CMITimespan: HHHH:MM:SS.SS
export function scormTimespan(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10) / 100);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total - h * 3600 - m * 60;
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  return `${pad(h, 4)}:${pad(m, 2)}:${s.toFixed(2).padStart(5, '0')}`;
}

// ISO 8601 duration for SCORM 2004 and xAPI, e.g. PT12.34S
export function isoDuration(ms: number): string {
  return `PT${(Math.max(0, Math.round(ms / 10)) / 100).toFixed(2)}S`;
}

export const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

// Hands out cmi.interactions.n indexes. A question keeps one entry however
// many times the learner retries it: later attempts update the entry's
// answer and result instead of adding duplicates to the LMS report. The
// starting index comes from the LMS's own _count (read once), so a resumed
// session appends after what earlier sessions wrote.
export class InteractionSlots {
  private map = new Map<string, number>();
  private next: number | null = null;

  slot(blockId: string, readCount: () => number): { index: number; isNew: boolean } {
    const known = this.map.get(blockId);
    if (known !== undefined) return { index: known, isNew: false };
    if (this.next === null) this.next = readCount();
    const index = this.next;
    this.next += 1;
    this.map.set(blockId, index);
    return { index, isNew: true };
  }
}
