import { InteractionSlots, clip, scormTimespan, toWire } from './interactions';
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
      case 'interaction':
        this.writeInteraction(event);
        break;
      case 'scored':
        this.call(() => this.api!.LMSSetValue('cmi.core.score.min', '0'));
        this.call(() => this.api!.LMSSetValue('cmi.core.score.max', '100'));
        this.call(() => this.api!.LMSSetValue('cmi.core.score.raw', String(event.score)));
        // 1.2 has one status field. Only write passed/failed when finishing
        // the course depends on the score; otherwise leave status alone so
        // courses that merely report a score behave as before.
        if (event.gated) {
          this.call(() => this.api!.LMSSetValue('cmi.core.lesson_status', event.passed ? 'passed' : 'failed'));
        }
        this.call(() => this.api!.LMSCommit(''));
        break;
      case 'completed':
        this.call(() => this.api!.LMSSetValue('cmi.core.lesson_status', event.passed ? 'passed' : 'completed'));
        this.call(() => this.api!.LMSCommit(''));
        break;
    }
  }

  private slots = new InteractionSlots();

  // cmi.interactions is optional in many LMSes; every write is best effort.
  private writeInteraction(event: Extract<TrackingEvent, { type: 'interaction' }>): void {
    const { index: i, isNew } = this.slots.slot(event.blockId, () =>
      parseInt(this.call(() => this.api!.LMSGetValue('cmi.interactions._count')) || '0', 10) || 0
    );
    const set = (k: string, v: string) => this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.${k}`, v));
    const wire = event.detail ? toWire(event.detail, 'scorm12') : null;
    // Identity, type and the correct answer are written once. A retry only
    // updates what changed (answer, result, time).
    if (isNew) {
      set('id', clip(event.blockId, 255));
      set('type', wire?.kind === 'other' || !wire ? 'performance' : wire.kind);
      wire?.correct.slice(0, 10).forEach((c, m) =>
        this.call(() => this.api!.LMSSetValue(`cmi.interactions.${i}.correct_responses.${m}.pattern`, clip(c, 255)))
      );
      set('weighting', '1');
    }
    set('student_response', clip(wire ? wire.response : event.response, 255));
    set('result', event.correct ? 'correct' : 'wrong');
    set('time', new Date().toTimeString().slice(0, 8));
    set('latency', scormTimespan(event.latencyMs));
    this.call(() => this.api!.LMSCommit(''));
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
