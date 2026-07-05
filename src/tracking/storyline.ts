import type { ResumeData, TrackingAdapter, TrackingEvent } from './adapter';
import { decodeResume, encodeResume } from './adapter';

// Storyline web object adapter. The published interaction runs inside an
// iframe in a Storyline course. It posts semantic messages to the parent;
// a paired Storyline JS trigger (generated at export) listens and pushes
// values into Storyline variables via the player SetVar API.
//
// Message shape (stable contract; the generated snippet depends on it):
//   { source: 'elearnforge', event: 'slideViewed'|'interaction'|'scored'|'completed',
//     payload: { ... } }

export class StorylineAdapter implements TrackingAdapter {
  private key = 'elearnforge.resume.webobject';

  private post(event: string, payload: Record<string, unknown>): void {
    try {
      window.parent?.postMessage({ source: 'elearnforge', event, payload }, '*');
    } catch (err) {
      console.warn('eLearnForge Storyline postMessage failed', err);
    }
  }

  initialize(courseTitle: string): ResumeData | null {
    this.key = `elearnforge.resume.${courseTitle}`;
    this.post('initialized', { title: courseTitle });
    try {
      return decodeResume(localStorage.getItem(this.key));
    } catch {
      return null;
    }
  }

  handle(event: TrackingEvent): void {
    switch (event.type) {
      case 'slideViewed':
        this.post('slideViewed', { index: event.index + 1, total: event.total });
        break;
      case 'interaction':
        this.post('interaction', { blockId: event.blockId, response: event.response, correct: event.correct });
        break;
      case 'scored':
        this.post('scored', { score: event.score });
        break;
      case 'completed':
        this.post('completed', { complete: true });
        break;
    }
  }

  saveResume(state: ResumeData): void {
    try { localStorage.setItem(this.key, encodeResume(state)); } catch { /* ignore */ }
  }

  terminate(): void {
    this.post('terminated', {});
  }
}
