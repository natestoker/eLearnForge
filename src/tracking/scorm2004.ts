import { InteractionSlots, clip, isoDuration, toWire } from './interactions';
import type { ResumeData, TrackingAdapter, TrackingEvent } from './adapter';
import { decodeResume, encodeResume } from './adapter';

// SCORM 2004 adapter. Same structure as 1.2 with the 2004 API object
// (API_1484_11), method names, and split completion/success statuses.

interface Scorm2004Api {
  Initialize(arg: string): string;
  Terminate(arg: string): string;
  GetValue(key: string): string;
  SetValue(key: string, value: string): string;
  Commit(arg: string): string;
}

function findApi(): Scorm2004Api | null {
  const scan = (start: Window | null): Scorm2004Api | null => {
    let w: Window | null = start;
    for (let i = 0; i < 10 && w; i++) {
      try {
        if ((w as any).API_1484_11) return (w as any).API_1484_11 as Scorm2004Api;
      } catch {
        return null;
      }
      if (w.parent === w) break;
      w = w.parent;
    }
    return null;
  };
  return scan(window) ?? (window.opener ? scan(window.opener as Window) : null);
}

export class Scorm2004Adapter implements TrackingAdapter {
  private api: Scorm2004Api | null = null;
  private terminated = false;
  private startedAt = Date.now();

  private call<T>(fn: () => T): T | null {
    if (!this.api || this.terminated) return null;
    try { return fn(); } catch (err) {
      console.warn('eLearnForge SCORM 2004 call failed', err);
      return null;
    }
  }

  initialize(): ResumeData | null {
    this.api = findApi();
    if (!this.api) {
      console.warn('eLearnForge: no SCORM 2004 API found; running untracked.');
      return null;
    }
    this.call(() => this.api!.Initialize(''));
    this.startedAt = Date.now();
    this.call(() => this.api!.SetValue('cmi.completion_status', 'incomplete'));
    const suspend = this.call(() => this.api!.GetValue('cmi.suspend_data'));
    this.call(() => this.api!.Commit(''));
    return decodeResume(suspend);
  }

  handle(event: TrackingEvent): void {
    switch (event.type) {
      case 'slideViewed':
        this.call(() => this.api!.SetValue('cmi.location', String(event.index + 1)));
        this.call(() => this.api!.Commit(''));
        break;
      case 'interaction':
        this.writeInteraction(event);
        break;
      case 'scored':
        this.call(() => this.api!.SetValue('cmi.score.min', '0'));
        this.call(() => this.api!.SetValue('cmi.score.max', '100'));
        this.call(() => this.api!.SetValue('cmi.score.raw', String(event.score)));
        this.call(() => this.api!.SetValue('cmi.score.scaled', String(event.score / 100)));
        this.call(() => this.api!.SetValue('cmi.success_status', event.passed ? 'passed' : 'failed'));
        this.call(() => this.api!.Commit(''));
        break;
      case 'completed':
        this.call(() => this.api!.SetValue('cmi.completion_status', 'completed'));
        this.call(() => this.api!.Commit(''));
        break;
    }
  }

  private slots = new InteractionSlots();

  private writeInteraction(event: Extract<TrackingEvent, { type: 'interaction' }>): void {
    const { index: i, isNew } = this.slots.slot(event.blockId, () =>
      parseInt(this.call(() => this.api!.GetValue('cmi.interactions._count')) || '0', 10) || 0
    );
    const set = (k: string, v: string) => this.call(() => this.api!.SetValue(`cmi.interactions.${i}.${k}`, v));
    const wire = event.detail ? toWire(event.detail, 'delimited') : null;
    if (isNew) {
      set('id', event.blockId);
      set('type', wire && wire.kind !== 'other' ? wire.kind : 'other');
      const description = event.detail && 'description' in event.detail ? event.detail.description : undefined;
      if (description) set('description', clip(description, 250));
      wire?.correct.slice(0, 10).forEach((c, m) =>
        this.call(() => this.api!.SetValue(`cmi.interactions.${i}.correct_responses.${m}.pattern`, c))
      );
      set('weighting', '1');
    }
    set('learner_response', clip(wire ? wire.response : event.response, wire?.kind === 'fill-in' ? 250 : 4000));
    set('result', event.correct ? 'correct' : 'incorrect');
    set('timestamp', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
    set('latency', isoDuration(event.latencyMs));
    this.call(() => this.api!.Commit(''));
  }

  saveResume(state: ResumeData): void {
    this.call(() => this.api!.SetValue('cmi.suspend_data', encodeResume(state)));
    this.call(() => this.api!.Commit(''));
  }

  terminate(): void {
    if (this.terminated) return;
    this.call(() => this.api!.SetValue('cmi.session_time', isoDuration(Date.now() - this.startedAt)));
    this.call(() => this.api!.Commit(''));
    this.call(() => this.api!.Terminate(''));
    this.terminated = true;
  }
}
