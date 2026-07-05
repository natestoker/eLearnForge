import type { ResumeData, TrackingAdapter, TrackingEvent } from './adapter';
import { decodeResume, encodeResume } from './adapter';

// xAPI (Tin Can launch style). The LMS launches index.html with query
// params: endpoint, auth, actor, activity_id, registration. Statements
// are fire-and-forget POSTs; a failed LRS must never break playback.
// Resume uses the xAPI State API when an endpoint exists, else localStorage.

const VERBS = {
  initialized: { id: 'http://adlnet.gov/expapi/verbs/initialized', display: { 'en-US': 'initialized' } },
  experienced: { id: 'http://adlnet.gov/expapi/verbs/experienced', display: { 'en-US': 'experienced' } },
  answered: { id: 'http://adlnet.gov/expapi/verbs/answered', display: { 'en-US': 'answered' } },
  scored: { id: 'http://adlnet.gov/expapi/verbs/scored', display: { 'en-US': 'scored' } },
  completed: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { 'en-US': 'completed' } },
  terminated: { id: 'http://adlnet.gov/expapi/verbs/terminated', display: { 'en-US': 'terminated' } }
};

export class XapiAdapter implements TrackingAdapter {
  private endpoint = '';
  private auth = '';
  private actor: any = null;
  private activityId = '';
  private registration = '';
  private title = 'eLearnForge course';

  private get active(): boolean {
    return Boolean(this.endpoint && this.actor);
  }

  initialize(courseTitle: string): ResumeData | null {
    this.title = courseTitle;
    const q = new URLSearchParams(window.location.search);
    this.endpoint = (q.get('endpoint') ?? '').replace(/\/+$/, '');
    this.auth = q.get('auth') ?? '';
    this.activityId = q.get('activity_id') ?? `urn:elearnforge:${encodeURIComponent(courseTitle)}`;
    this.registration = q.get('registration') ?? '';
    try {
      this.actor = q.get('actor') ? JSON.parse(q.get('actor')!) : null;
    } catch {
      this.actor = null;
    }
    if (!this.active) {
      console.warn('eLearnForge: no xAPI launch params; statements disabled, local resume only.');
      return decodeResume(localStorage.getItem(this.localKey()));
    }
    this.send(VERBS.initialized, {});
    // State API resume is synchronous-ish at boot: try it, fall back local.
    // Kept best-effort; a slow LRS should not delay first paint, so we only
    // read localStorage here and let saveResume write both.
    return decodeResume(localStorage.getItem(this.localKey()));
  }

  private localKey(): string {
    return `elearnforge.resume.${this.activityId || this.title}`;
  }

  private statement(verb: (typeof VERBS)[keyof typeof VERBS], objectSuffix: string, extra: any): any {
    const st: any = {
      actor: this.actor,
      verb,
      object: {
        id: objectSuffix ? `${this.activityId}/${objectSuffix}` : this.activityId,
        definition: { name: { 'en-US': objectSuffix ? `${this.title} - ${objectSuffix}` : this.title } }
      },
      timestamp: new Date().toISOString(),
      ...extra
    };
    if (this.registration) st.context = { registration: this.registration };
    return st;
  }

  private send(verb: (typeof VERBS)[keyof typeof VERBS], extra: any, objectSuffix = ''): void {
    if (!this.active) return;
    const body = JSON.stringify(this.statement(verb, objectSuffix, extra));
    fetch(`${this.endpoint}/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Experience-API-Version': '1.0.3',
        ...(this.auth ? { Authorization: this.auth } : {})
      },
      body,
      keepalive: true
    }).catch((err) => console.warn('eLearnForge xAPI statement failed', err));
  }

  handle(event: TrackingEvent): void {
    switch (event.type) {
      case 'slideViewed':
        this.send(VERBS.experienced, {}, `slide/${event.index + 1}`);
        break;
      case 'interaction':
        this.send(
          VERBS.answered,
          { result: { success: event.correct, response: event.response.slice(0, 255) } },
          `block/${event.blockId}`
        );
        break;
      case 'scored':
        this.send(VERBS.scored, { result: { score: { raw: event.score, min: 0, max: 100, scaled: event.score / 100 } } });
        break;
      case 'completed':
        this.send(VERBS.completed, { result: { completion: true } });
        break;
    }
  }

  saveResume(state: ResumeData): void {
    const encoded = encodeResume(state);
    try { localStorage.setItem(this.localKey(), encoded); } catch { /* private mode */ }
    if (!this.active) return;
    const url = `${this.endpoint}/activities/state?` + new URLSearchParams({
      activityId: this.activityId,
      agent: JSON.stringify(this.actor),
      stateId: 'resume',
      ...(this.registration ? { registration: this.registration } : {})
    });
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Experience-API-Version': '1.0.3',
        ...(this.auth ? { Authorization: this.auth } : {})
      },
      body: encoded,
      keepalive: true
    }).catch(() => { /* best effort */ });
  }

  terminate(): void {
    this.send(VERBS.terminated, {});
  }
}
