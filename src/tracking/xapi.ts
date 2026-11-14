import type { ResumeData, TrackingAdapter, TrackingEvent } from './adapter';
import { decodeResume, encodeResume } from './adapter';
import type { InteractionDetail } from './adapter';
import { fitsIdScheme, idOf, isoDuration, toWire } from './interactions';

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
  passed: { id: 'http://adlnet.gov/expapi/verbs/passed', display: { 'en-US': 'passed' } },
  failed: { id: 'http://adlnet.gov/expapi/verbs/failed', display: { 'en-US': 'failed' } },
  terminated: { id: 'http://adlnet.gov/expapi/verbs/terminated', display: { 'en-US': 'terminated' } }
};

const ATTEMPT_EXT = 'https://elearnforge.com/xapi/extensions/attempt';

const lang = (s: string) => ({ 'en-US': s });

export class XapiAdapter implements TrackingAdapter {
  private endpoint = '';
  private auth = '';
  private actor: any = null;
  private activityId = '';
  private registration = '';
  private title = 'eLearnForge course';
  private lastScore: number | null = null;

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

  // The question as an xAPI cmi.interaction activity: type, choices or
  // source/target lists, and the correct response pattern(s).
  private interactionObject(blockId: string, detail: InteractionDetail | undefined): any {
    const obj: any = { objectType: 'Activity', id: `${this.activityId}/block/${blockId}` };
    const description = detail && 'description' in detail ? detail.description : undefined;
    const def: any = {
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      name: lang(`${this.title} - question`),
      ...(description ? { description: lang(description) } : {})
    };
    const wire = detail && fitsIdScheme(detail) ? toWire(detail, 'delimited') : null;
    if (detail && wire) {
      const comp = (texts: string[]) => texts.map((t, i) => ({ id: idOf(i), description: lang(t) }));
      def.interactionType = wire.kind;
      def.correctResponsesPattern = wire.correct;
      if (detail.kind === 'choice') def.choices = comp(detail.choices);
      if (detail.kind === 'sequencing') def.choices = comp(detail.items);
      if (detail.kind === 'matching') { def.source = comp(detail.sources); def.target = comp(detail.targets); }
    } else {
      def.interactionType = 'other';
    }
    obj.definition = def;
    return obj;
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
    st.context = {
      ...(this.registration ? { registration: this.registration } : {}),
      // Sub-activities (slides, questions) point back at the course.
      ...(objectSuffix ? { contextActivities: { parent: [{ id: this.activityId, objectType: 'Activity' }] } } : {})
    };
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
      case 'interaction': {
        const wire = event.detail ? toWire(event.detail, 'delimited') : null;
        this.send(
          VERBS.answered,
          {
            object: this.interactionObject(event.blockId, event.detail),
            result: {
              success: event.correct,
              completion: true,
              response: (wire ? wire.response : event.response).slice(0, 4000),
              duration: isoDuration(event.latencyMs),
              extensions: { [ATTEMPT_EXT]: event.attempt }
            }
          },
          `block/${event.blockId}`
        );
        break;
      }
      case 'scored':
        this.lastScore = event.score;
        this.send(VERBS.scored, { result: { score: { raw: event.score, min: 0, max: 100, scaled: event.score / 100 }, success: event.passed } });
        break;
      case 'completed':
        this.send(VERBS.completed, { result: { completion: true, ...(event.passed !== undefined ? { success: event.passed } : {}) } });
        // A pass-gated course also says passed or failed, which is the
        // statement most LRS dashboards key their pass rate on.
        if (event.passed !== undefined) {
          this.send(event.passed ? VERBS.passed : VERBS.failed, {
            result: {
              success: event.passed,
              ...(this.lastScore !== null ? { score: { raw: this.lastScore, min: 0, max: 100, scaled: this.lastScore / 100 } } : {})
            }
          });
        }
        break;
    }
  }

  // Resume from the LRS, for a learner opening the course on another device or
  // browser (localStorage only knows this one).
  async loadResume(): Promise<ResumeData | null> {
    if (!this.active) return null;
    const url = `${this.endpoint}/activities/state?` + new URLSearchParams({
      activityId: this.activityId,
      agent: JSON.stringify(this.actor),
      stateId: 'resume',
      ...(this.registration ? { registration: this.registration } : {})
    });
    try {
      const res = await fetch(url, {
        headers: { 'X-Experience-API-Version': '1.0.3', ...(this.auth ? { Authorization: this.auth } : {}) }
      });
      if (!res.ok) return null;
      return decodeResume(await res.text());
    } catch {
      return null;
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

  private terminated = false;

  terminate(): void {
    // Exit course and the pagehide handler can both end the session.
    if (this.terminated) return;
    this.terminated = true;
    this.send(VERBS.terminated, {});
  }
}
