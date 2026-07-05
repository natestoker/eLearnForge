import type { ResumeData, TrackingAdapter } from './adapter';
import { decodeResume, encodeResume } from './adapter';
import { Scorm12Adapter } from './scorm12';
import { Scorm2004Adapter } from './scorm2004';
import { XapiAdapter } from './xapi';
import { StorylineAdapter } from './storyline';

export type PublishTarget = 'web' | 'scorm12' | 'scorm2004' | 'xapi' | 'storyline';

// Web target: no host to talk to; resume via localStorage so a learner
// refreshing a plain hosted course does not lose their place.
class WebAdapter implements TrackingAdapter {
  private key = 'elearnforge.resume.web';
  initialize(courseTitle: string): ResumeData | null {
    this.key = `elearnforge.resume.${courseTitle}`;
    try { return decodeResume(localStorage.getItem(this.key)); } catch { return null; }
  }
  handle(): void { /* nothing to report to */ }
  saveResume(state: ResumeData): void {
    try { localStorage.setItem(this.key, encodeResume(state)); } catch { /* ignore */ }
  }
  terminate(): void { /* noop */ }
}

export function createAdapter(target: PublishTarget): TrackingAdapter {
  switch (target) {
    case 'scorm12': return new Scorm12Adapter();
    case 'scorm2004': return new Scorm2004Adapter();
    case 'xapi': return new XapiAdapter();
    case 'storyline': return new StorylineAdapter();
    default: return new WebAdapter();
  }
}
