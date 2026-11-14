import type { VariableValue } from '../schema/types';

// The runtime emits semantic events. Publish targets supply an adapter that
// translates them into a concrete protocol (SCORM 1.2/2004 calls, xAPI
// statements, postMessage to a Storyline parent). Writing this interface
// once is what makes every future format a file instead of a refactor.

// What a question block knows about its own answer. Options are listed by
// position and answers refer to those positions, so each adapter can build
// the identifiers its protocol wants (see interactions.ts).
export type InteractionDetail =
  | { kind: 'choice'; description: string; choices: string[]; learner: number[]; correct: number[] }
  // items are listed in their correct order; learner is the order the
  // learner put them in, as positions in items.
  | { kind: 'sequencing'; description: string; items: string[]; learner: number[]; correct: number[] }
  // pairs are [source position, target position].
  | { kind: 'matching'; description: string; sources: string[]; targets: string[];
      learner: [number, number][]; correct: [number, number][] }
  | { kind: 'fill-in'; description: string; learner: string; correct: string[]; caseSensitive?: boolean }
  | { kind: 'other'; description?: string };

export type TrackingEvent =
  | { type: 'slideViewed'; slideId: string; index: number; total: number }
  | {
      type: 'interaction';
      blockId: string;
      response: string;   // human-readable answer, for hosts that just show text
      correct: boolean;
      attempt: number;    // 1 for the first answer to this question, 2 for the retry, ...
      latencyMs: number;  // time on the slide before this answer
      detail?: InteractionDetail; // absent for custom code that only reports right/wrong
    }
  // passed: score >= the course pass mark. gated: finishing the course
  // depends on passing, so an LMS status of passed/failed is meaningful.
  | { type: 'scored'; score: number; passed: boolean; gated: boolean }
  // passed is only set when completion is gated on the score.
  | { type: 'completed'; passed?: boolean };

// What the runtime hands an adapter to store (SCORM suspend_data, xAPI state,
// localStorage). Two shapes:
//  - CompactResume (v2): what the player saves now. Slides and questions are
//    stored by position, not id, so a course with a few hundred slides still
//    fits SCORM 1.2's 4,096-character suspend_data. n holds the slide and
//    question counts so a state saved by a different version of the course is
//    recognized and only partly applied instead of scrambled.
//  - RichResume: the original id-keyed shape. Still read, so learners who
//    started a course before this change keep their place.
export interface RichResume {
  slideId: string;
  variables: Record<string, VariableValue>;
  viewedSlideIds: string[];
  // Score so far, and each graded block's latest result (blockId -> correct).
  score?: number;
  answers?: Record<string, boolean>;
  attempts?: Record<string, number>;
}

export interface CompactResume {
  v: 2;
  si: number;                 // current slide index
  n: [number, number];        // [slide count, graded question count] when saved
  vw: string;                 // one char per slide: 1 viewed, 0 not
  an?: string;                // one char per question: 1 right, 0 wrong, - unanswered
  at?: string;                // one char per question: attempts so far (0-9)
  sc?: number;                // score
  bk?: number[][];            // question banks: for each, the slide positions drawn, in order
  vr?: Record<string, VariableValue>; // non-default variables, by name
}

export type ResumeData = RichResume | CompactResume;

export const isCompact = (r: ResumeData): r is CompactResume => (r as CompactResume).v === 2;

export interface TrackingAdapter {
  // Called once before the player mounts. Returns resume data if the host
  // has any (SCORM suspend_data, localStorage, ...), else null.
  initialize(courseTitle: string): ResumeData | null;
  handle(event: TrackingEvent): void;
  // Optional. For hosts whose resume data arrives asynchronously (the xAPI
  // State API). The player applies it if the learner hasn't moved yet.
  loadResume?(): Promise<ResumeData | null>;
  // Called on visibilitychange/pagehide with the latest resume state.
  saveResume(state: ResumeData): void;
  terminate(): void;
}

// Shared helper: resume payloads must stay small. SCORM 1.2 caps
// suspend_data at 4096 characters, so only non-default variables are
// included upstream and we hard-guard the length here.
const CAP = 4000;

export function encodeResume(state: ResumeData): string {
  const json = JSON.stringify(state);
  if (json.length <= CAP) return json;
  // Too big: shed the least important data first and never exceed the cap.
  // Order of importance: position, viewed slides, score, answers and attempts,
  // then everything else.
  if (isCompact(state)) {
    const tries: CompactResume[] = [
      { ...state, vr: undefined },
      { ...state, vr: undefined, at: undefined },
      { ...state, vr: undefined, at: undefined, an: undefined }
    ];
    for (const t of tries) { const j = JSON.stringify(t); if (j.length <= CAP) return j; }
    return JSON.stringify({ v: 2, si: state.si, n: state.n, vw: '', sc: state.sc, bk: state.bk });
  }
  const keep = { slideId: state.slideId, viewedSlideIds: state.viewedSlideIds, score: state.score, answers: state.answers, attempts: state.attempts };
  const noVars = JSON.stringify({ ...keep, variables: {} });
  if (noVars.length <= CAP) return noVars;
  const noAnswers = JSON.stringify({ slideId: state.slideId, viewedSlideIds: state.viewedSlideIds, score: state.score, attempts: state.attempts, variables: {} });
  if (noAnswers.length <= CAP) return noAnswers;
  const tiny = JSON.stringify({ slideId: state.slideId, viewedSlideIds: state.viewedSlideIds, score: state.score, variables: {} });
  if (tiny.length <= CAP) return tiny;
  return JSON.stringify({ slideId: state.slideId, variables: {}, viewedSlideIds: [], score: state.score });
}

export function decodeResume(raw: string | null | undefined): ResumeData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 2 && typeof parsed.si === 'number' && Array.isArray(parsed.n)) return parsed as CompactResume;
    if (parsed && typeof parsed.slideId === 'string') return parsed as RichResume;
  } catch {
    // fall through
  }
  return null;
}
