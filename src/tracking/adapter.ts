import type { VariableValue } from '../schema/types';

// The runtime emits semantic events. Publish targets supply an adapter that
// translates them into a concrete protocol (SCORM 1.2/2004 calls, xAPI
// statements, postMessage to a Storyline parent). Writing this interface
// once is what makes every future format a file instead of a refactor.

export type TrackingEvent =
  | { type: 'slideViewed'; slideId: string; index: number; total: number }
  | { type: 'interaction'; blockId: string; response: string; correct: boolean }
  // passed: score >= the course pass mark. gated: finishing the course
  // depends on passing, so an LMS status of passed/failed is meaningful.
  | { type: 'scored'; score: number; passed: boolean; gated: boolean }
  // passed is only set when completion is gated on the score.
  | { type: 'completed'; passed?: boolean };

export interface ResumeData {
  slideId: string;
  variables: Record<string, VariableValue>;
  viewedSlideIds: string[];
  // Score so far, and each graded block's latest result (blockId -> correct).
  score?: number;
  answers?: Record<string, boolean>;
}

export interface TrackingAdapter {
  // Called once before the player mounts. Returns resume data if the host
  // has any (SCORM suspend_data, localStorage, ...), else null.
  initialize(courseTitle: string): ResumeData | null;
  handle(event: TrackingEvent): void;
  // Called on visibilitychange/pagehide with the latest resume state.
  saveResume(state: ResumeData): void;
  terminate(): void;
}

// Shared helper: resume payloads must stay small. SCORM 1.2 caps
// suspend_data at 4096 characters, so only non-default variables are
// included upstream and we hard-guard the length here.
export function encodeResume(state: ResumeData): string {
  const json = JSON.stringify(state);
  if (json.length <= 4000) return json;
  // Too big: drop variables first, keep position, never exceed the cap.
  // The score and the answers behind it matter more than other variables, so
  // they outlast them. Last resort: position and score only.
  const keep = { slideId: state.slideId, viewedSlideIds: state.viewedSlideIds, score: state.score, answers: state.answers };
  const noVars = JSON.stringify({ ...keep, variables: {} });
  if (noVars.length <= 4000) return noVars;
  const noAnswers = JSON.stringify({ slideId: state.slideId, viewedSlideIds: state.viewedSlideIds, score: state.score, variables: {} });
  if (noAnswers.length <= 4000) return noAnswers;
  return JSON.stringify({ slideId: state.slideId, variables: {}, viewedSlideIds: [], score: state.score });
}

export function decodeResume(raw: string | null | undefined): ResumeData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.slideId === 'string') return parsed as ResumeData;
  } catch {
    // fall through
  }
  return null;
}
