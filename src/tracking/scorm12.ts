import type { ResumeData, TrackingAdapter, TrackingEvent } from './adapter';
import { decodeResume, encodeResume } from './adapter';

// SCORM 1.2 adapter. The API-finder walks up the window chain because
// LMSes inject the API object on a parent or opener frame. Every LMS call
// is wrapped so a flaky host can never break playback. This mirrors the
// pattern proven in the PPTX Narrator SCORM engine.

interface Scorm12Api {
  LMSInitialize(arg: string): string;
  LMSFinish(arg: string): string;
  LMSGetValue(key: string): string;
  LMSSetValue(key: string, value: string): string;
  LMSCommit(arg: string): string;
}

function findApi(): Scorm12Api | null {
  const scan = (start: Window | null): Scorm12Api | null => {
    let w: Window | null = start;
    for (let i = 0; i < 10 && w; i++) {
      try {
        if ((w as any).API) return (w as any).API as Scorm12Api;
      } catch {
        return null; // cross-origin wall
      }
      if (w.parent === w) break;
      w = w.parent;
    }
    return null;
  };
  return scan(window) ?? (window.opener ? scan(window.opener as Window) : null);
}

export class Scorm12Adapter implements TrackingAdapter {
  private api: Scorm12Api | null = null;
  private terminated = false;

  private call<T>(fn: () => T): T | null {
    if (!this.api || this.terminated) return null;
    try { return fn(); } catch (err) {
      console.warn('eLearnForge SCORM 1.2 call failed', err);
      return null;
    }
  }

  initialize(): ResumeData | null {
    this.api = findApi();
    if (!this.api) {
      console.warn('eLearnForge: no SCORM 1.2 API found; running untracked.');
      return null;
    }
    this.call(() => this.api!.LMSInitialize(''));
    const status = this.call(() => this.api!.LMSGetValue('cmi.core.lesson_status'));
    if (status === 'not attempted' || status === '' || status === null) {
      this.call(() => this.api!.LMSSetValue('cmi.core.lesson_status', 'incomplete'));
    }
    const suspend = this.call(() => this.api!.LMSGetValue('cmi.suspend_data'));
    this.call(() => this.api!.LMSCommit(''));
    return decodeResume(suspend);
  }

  handle(event: TrackingEvent): void {
    switch (event.type) {
      case 'slideViewed':
        this.call(() => this.api!.LMSSetValue('cmi.core.lesson_location', String(event.index + 1)));
        this.call(() => this.api!.LMSCommit(''));
        break;
      case 'interaction': {
        // cmi.interactions is optional in many LMSes; write it and move on.
        const n = this.call(() => this.api!.LMSGetValue('cmi.interactions._count')) || '0';
        const i = parseInt(n, 10) || 0;
        this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.id`, event.blockId));
        this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.type`, 'choice'));
        this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.student_response`, event.response.slice(0, 255)));
        this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.result`, event.correct ? 'correct' : 'wrong'));
        this.call(() => this.api!.LMSCommit(''));
        break;
      }
      case 'scored':
        this.call(() => this.api!.LMSSetValue('cmi.core.score.min', '0'));
        this.call(() => this.api!.LMSSetValue('cmi.core.score.max', '100'));
        this.call(() => this.api!.LMSSetValue('cmi.core.score.raw', String(event.score)));
        this.call(() => this.api!.LMSCommit(''));
        break;
      case 'completed':
        this.call(() => this.api!.LMSSetValue('cmi.core.lesson_status', 'completed'));
        this.call(() => this.api!.LMSCommit(''));
        break;
    }
  }

  saveResume(state: ResumeData): void {
    this.call(() => this.api!.LMSSetValue('cmi.suspend_data', encodeResume(state)));
    this.call(() => this.api!.LMSCommit(''));
  }

  terminate(): void {
    if (this.terminated) return;
    this.call(() => this.api!.LMSCommit(''));
    this.call(() => this.api!.LMSFinish(''));
    this.terminated = true;
  }
}
