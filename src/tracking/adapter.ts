import type { VariableValue } from '../schema/types';

// The runtime emits semantic events. Publish targets supply an adapter that
// translates them into a concrete protocol (SCORM 1.2/2004 calls, xAPI
// statements, postMessage to a Storyline parent). Writing this interface
// once is what makes every future format a file instead of a refactor.

export type TrackingEvent =
  | { type: 'slideViewed'; slideId: string; index: number; total: number }
  | { type: 'interaction'; blockId: string; response: string; correct: boolean }
  | { type: 'scored'; score: number }
  | { type: 'completed' };

export interface ResumeData {
  slideId: string;
  variables: Record<string, VariableValue>;
  viewedSlideIds: string[];
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
  const slim = JSON.stringify({ slideId: state.slideId, variables: {}, viewedSlideIds: state.viewedSlideIds });
  return slim.length <= 4000 ? slim : JSON.stringify({ slideId: state.slideId, variables: {}, viewedSlideIds: [] });
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
