import { useEffect, useId, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useUiStore, type CourseSettingsSection } from '../state/uiStore';
import { defaultPlayerSettings, uid } from '../schema/factory';
import type { PlayerSettings, Project } from '../schema/types';
import { GRADED_BLOCK_TYPES } from '../engine/scoring';
import { useFocusTrap } from '../shared/useFocusTrap';
import { ColorInput, SelectInput, TextInput } from './fields';
import { EmphasisTriggerSection } from './GlobalSettings';
import { BanksEditor } from './BanksEditor';
import { Lucide } from './lucide';

// One dialog for everything that belongs to the course as a whole: theme,
// player, resources, glossary and question banks. Settings apply as they
// change (each is one undo step), so the footer has a single Done button.

const TRANSITIONS = [
  ['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide (subtle)'], ['slideLeft', 'Slide from right'],
  ['slideRight', 'Slide from left'], ['slideUp', 'Slide up'], ['zoom', 'Zoom in'], ['zoomOut', 'Zoom out'],
  ['flip', 'Flip'], ['pageFlip', 'Page flip']
].map(([value, label]) => ({ value, label }));

const walk = (blocks: any[]): any[] => blocks.flatMap((b) => (b.type === 'group' ? [b, ...walk(b.props.blocks)] : [b]));

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="cs-section">
      <h3 className="cs-label">{label}</h3>
      <div className="cs-card">{children}</div>
    </section>
  );
}

function Line({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  // The label wraps the control, so a select or input is named by its row.
  return (
    <label className="cs-line">
      <span className="cs-line-text">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </span>
      <span className="cs-line-control">{children}</span>
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cs-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cs-toggle-text"><b>{label}</b>{hint && <span>{hint}</span>}</span>
    </label>
  );
}

function Empty({ icon, title, body, children, example }: { icon: string; title: string; body: string; children: React.ReactNode; example?: React.ReactNode }) {
  return (
    <div className="cs-empty">
      <div className="cs-empty-main">
        <span className="cs-empty-icon"><Lucide name={icon} size={22} /></span>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="cs-empty-actions">{children}</div>
      </div>
      {example && <div className="cs-empty-example" aria-hidden="true">{example}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ theme
function ThemeSection() {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const palette = project.theme?.palette ?? [];
  return (
    <>
      <Section label="Accent">
        <Line label="Accent color" hint="Recolors the editor and the player. Kept readable automatically.">
          <ColorInput
            value={project.theme?.accent ?? '#3ddc97'}
            onChange={(v) => mutate((p) => { p.theme = { accent: v, palette: p.theme?.palette }; })}
          />
        </Line>
      </Section>
      <Section label="Brand colors">
        <div className="cs-line">
          <div className="cs-line-text"><b>Swatches</b><span>Shown in every color picker.</span></div>
          <div className="cs-swatches">
            {palette.map((c, i) => (
              <span key={i} className="cs-swatch" style={{ background: c }}>
                <input
                  type="color" aria-label={`Brand color ${i + 1}`} value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#3ddc97'}
                  onChange={(e) => mutate((p) => { if (p.theme?.palette) p.theme.palette[i] = e.target.value; })}
                />
                <button
                  type="button" className="cs-swatch-x" aria-label={`Remove brand color ${c}`} title="Remove"
                  onClick={() => mutate((p) => { if (p.theme?.palette) p.theme.palette = p.theme.palette.filter((_, j) => j !== i); })}
                ><Lucide name="x" size={10} /></button>
              </span>
            ))}
            <button
              type="button" className="cs-swatch add" aria-label="Add a brand color" title="Add a brand color"
              onClick={() => mutate((p) => { p.theme = p.theme ?? { accent: '#3ddc97' }; p.theme.palette = [...(p.theme.palette ?? []), '#5b8def']; })}
            ><Lucide name="plus" size={14} /></button>
          </div>
        </div>
      </Section>
      <Section label="Slides">
        <Line label="Default slide transition" hint="A slide can override this in its own settings.">
          <SelectInput
            value={project.slideTransition ?? 'none'}
            options={TRANSITIONS}
            onChange={(v) => mutate((p) => { p.slideTransition = v === 'none' ? undefined : (v as 'fade'); })}
          />
        </Line>
      </Section>
    </>
  );
}

// ----------------------------------------------------------------- player
function PlayerPreview({ player, accent, slideName, total }: { player: PlayerSettings; accent: string; slideName: string; total: number }) {
  const light = player.chrome === 'light';
  const radius = player.buttonShape === 'pill' ? 999 : player.buttonShape === 'square' ? 2 : 6;
  const outline = player.buttonStyle === 'outline';
  const btn = (label: string, primary: boolean) => (
    <span
      className="cs-pv-btn"
      style={{
        borderRadius: radius,
        background: primary && !outline ? accent : 'transparent',
        color: primary ? (outline ? accent : '#06150d') : light ? '#333' : '#cfd6d1',
        borderColor: primary ? accent : light ? '#b9c2bc' : '#3b463f'
      }}
    >{label}</span>
  );
  const nav = (
    <span className="cs-pv-nav">
      {player.back.show && btn(player.back.label || 'Back', false)}
      {player.submit.show && btn(player.submit.label || 'Submit', true)}
      {player.next.show && btn(player.next.label || 'Next', true)}
    </span>
  );
  const caption = <span className="cs-pv-caption">{slideName} · 1 / {total}</span>;
  return (
    <div className="cs-pv" style={{ background: light ? '#eef1ee' : '#0d100e' }} aria-hidden="true">
      {player.titlePosition === 'top' && <div className="cs-pv-title" style={{ color: accent }}>Course title</div>}
      <div className="cs-pv-stage">
        {player.menu.show && <span className="cs-pv-menu" style={{ borderColor: light ? '#b9c2bc' : '#3b463f' }}><Lucide name="layout-list" size={12} /></span>}
        <span className="cs-pv-slide" />
      </div>
      {player.progressBar && <div className="cs-pv-progress"><span style={{ background: accent }} /></div>}
      <div className="cs-pv-bar" style={{ color: light ? '#333' : '#cfd6d1', flexDirection: player.navPosition === 'left' ? 'row-reverse' : 'row' }}>
        {player.titlePosition !== 'hidden' && player.titlePosition !== 'top' ? caption : <span />}
        {nav}
      </div>
    </div>
  );
}

function PlayerSection() {
  const mutate = useProjectStore((s) => s.mutate);
  const project = useProjectStore((s) => s.project);
  const player = project.player ?? defaultPlayerSettings();
  const set = (fn: (pl: PlayerSettings) => void) => mutate((p) => { p.player = p.player ?? defaultPlayerSettings(); fn(p.player); });
  const accent = player.accent ?? project.theme?.accent ?? '#3ddc97';
  const select = (value: string, options: [string, string][], onChange: (v: string) => void) => (
    <SelectInput value={value} options={options.map(([v, l]) => ({ value: v, label: l }))} onChange={onChange} />
  );
  return (
    <div className="cs-split">
      <div className="cs-split-main">
        <Section label="Navigation buttons">
          <div className="cs-navgrid" role="group" aria-label="Navigation buttons">
            <span className="cs-navgrid-h">Show</span><span className="cs-navgrid-h">Button</span><span className="cs-navgrid-h">Label learners see</span>
            {(['back', 'next', 'submit'] as const).map((key) => (
              <div key={key} className="cs-navrow">
                <input
                  type="checkbox" aria-label={`Show the ${key} button`} checked={player[key].show}
                  onChange={(e) => set((pl) => { pl[key] = { ...pl[key], show: e.target.checked }; })}
                />
                <span className="cs-navname">{key[0].toUpperCase() + key.slice(1)}</span>
                <TextInput ariaLabel={`Label for the ${key} button`} value={player[key].label} onChange={(v) => set((pl) => { pl[key] = { ...pl[key], label: v }; })} />
              </div>
            ))}
          </div>
        </Section>
        <Section label="Controls">
          <Toggle label="Menu button" hint="Opens the slide list" checked={player.menu.show} onChange={(v) => set((pl) => { pl.menu.show = v; })} />
          {player.menu.show && (
            <Toggle label="Lock menu" hint="View only, no jumping ahead" checked={player.menu.locked ?? false} onChange={(v) => set((pl) => { pl.menu.locked = v || undefined; })} />
          )}
          <Toggle label="Course progress bar" checked={player.progressBar ?? false} onChange={(v) => set((pl) => { pl.progressBar = v || undefined; })} />
          <Toggle label="Closed captions button" hint="Only on slides that have captions" checked={player.captionsButton ?? true} onChange={(v) => set((pl) => { pl.captionsButton = v; })} />
        </Section>
        <Section label="Appearance">
          <Line label="Chrome">{select(player.chrome ?? 'dark', [['dark', 'Dark'], ['light', 'Light'], ['minimal', 'Minimal']], (v) => set((pl) => { pl.chrome = v as 'dark'; }))}</Line>
          <Line label="Button shape">{select(player.buttonShape ?? 'rounded', [['rounded', 'Rounded'], ['pill', 'Pill'], ['square', 'Square']], (v) => set((pl) => { pl.buttonShape = v as 'rounded'; }))}</Line>
          <Line label="Button style">{select(player.buttonStyle ?? 'solid', [['solid', 'Solid'], ['outline', 'Outline']], (v) => set((pl) => { pl.buttonStyle = v as 'solid'; }))}</Line>
          <Line label="Hover effect">{select(player.buttonHover ?? 'none', [['none', 'None'], ['lift', 'Lift'], ['glow', 'Glow'], ['scale', 'Scale'], ['brightness', 'Brighten']], (v) => set((pl) => { pl.buttonHover = v === 'none' ? undefined : (v as 'lift'); }))}</Line>
          <Line label="Next / Submit emphasis">{select(player.buttonEmphasis ?? 'none', [['none', 'None'], ['pulse', 'Pulse'], ['glow', 'Glow']], (v) => set((pl) => { pl.buttonEmphasis = v === 'none' ? undefined : (v as 'pulse'); }))}</Line>
          {player.buttonEmphasis && player.buttonEmphasis !== 'none' && (
            <div className="cs-nested"><EmphasisTriggerSection player={player} mutate={mutate as (fn: (p: Project) => void, history?: boolean) => void} /></div>
          )}
          <Line label="Button position">{select(player.navPosition ?? 'right', [['right', 'Bottom bar, right'], ['left', 'Bottom bar, left']], (v) => set((pl) => { pl.navPosition = v === 'right' ? undefined : 'left'; }))}</Line>
          <Line label="Course title">{select(player.titlePosition ?? 'bottom', [['bottom', 'Bottom bar'], ['top', 'Title bar above the slide'], ['hidden', 'Hidden']], (v) => set((pl) => { pl.titlePosition = v === 'bottom' ? undefined : (v as 'top'); }))}</Line>
          <div className="cs-line">
            <div className="cs-line-text"><b>Accent</b><span>{player.accent ? 'A color just for the player.' : 'Uses the course accent (Theme).'}</span></div>
            <div className="cs-line-control cs-accent-override">
              {player.accent
                ? <><ColorInput value={player.accent} onChange={(v) => set((pl) => { pl.accent = v; })} /><button type="button" className="btn btn-ghost" onClick={() => set((pl) => { pl.accent = undefined; })}>Use course accent</button></>
                : <button type="button" className="btn btn-ghost" onClick={() => set((pl) => { pl.accent = project.theme?.accent ?? '#3ddc97'; })}>Use a different color</button>}
            </div>
          </div>
        </Section>
        <p className="cs-note">Triggers can also enable or disable Next, Back and Submit on a single slide.</p>
      </div>
      <aside className="cs-split-side">
        <h3 className="cs-label">Live preview</h3>
        <PlayerPreview player={player} accent={accent} slideName={project.slides[0]?.name ?? 'Slide'} total={project.slides.length} />
        <p className="cs-note">Updates as settings change, so you don't need to open Preview to check a label.</p>
      </aside>
    </div>
  );
}

// -------------------------------------------------------------- resources
function bytesOf(url: string): number | null {
  if (!url.startsWith('data:')) return null;
  const i = url.indexOf(',');
  return i < 0 ? null : Math.round((url.length - i - 1) * 0.75);
}
const fmt = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function ResourcesSection() {
  const resources = useProjectStore((s) => s.project.resources) ?? [];
  const mutate = useProjectStore((s) => s.mutate);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const update = (id: string, patch: Partial<{ title: string; url: string; description: string }>) =>
    mutate((p) => { const r = p.resources?.find((x) => x.id === id); if (r) Object.assign(r, patch); });
  const addLink = () => mutate((p) => { p.resources = [...(p.resources ?? []), { id: uid('res'), title: 'New resource', url: '' }]; });
  const pick = (id: string | null) => { target.current = id; fileRef.current?.click(); };
  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (target.current) update(target.current, { url, title: file.name });
      else mutate((p) => { p.resources = [...(p.resources ?? []), { id: uid('res'), title: file.name, url }]; });
    };
    reader.readAsDataURL(file);
  };
  const input = <input ref={fileRef} type="file" hidden aria-label="Upload a resource file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />;
  if (!resources.length) {
    return (
      <>
        {input}
        <Empty
          icon="file-text" title="No resources yet"
          body="Give learners files and links to keep: a checklist, a policy, a page to report a problem. They open the list from the Resources button on any slide."
          example={<><b>Example · what learners see</b><div className="cs-ghost"><i>Phishing checklist (PDF)</i><span>212 KB</span></div><div className="cs-ghost"><i>Report a suspicious email</i><span>Link</span></div></>}
        >
          <button type="button" className="btn btn-accent" onClick={() => pick(null)}><Lucide name="upload" size={14} /> Upload a file</button>
          <button type="button" className="btn" onClick={addLink}><Lucide name="link" size={14} /> Add a link</button>
        </Empty>
      </>
    );
  }
  return (
    <>
      {input}
      <div className="cs-toolbar">
        <span className="cs-label">Shown in the player's Resources panel</span>
        <span className="cs-toolbar-actions">
          <button type="button" className="btn" onClick={() => pick(null)}><Lucide name="upload" size={14} /> Upload a file</button>
          <button type="button" className="btn" onClick={addLink}><Lucide name="link" size={14} /> Add a link</button>
        </span>
      </div>
      <div className="cs-list">
        {resources.map((r) => {
          const size = bytesOf(r.url);
          return (
            <div key={r.id} className="cs-item">
              <span className="cs-item-icon"><Lucide name={size !== null ? 'file-text' : 'link'} size={16} /></span>
              <div className="cs-item-fields">
                <label className="cs-field"><span>Title</span><TextInput value={r.title} onChange={(v) => update(r.id, { title: v })} /></label>
                {size !== null
                  ? <div className="cs-file"><span>Embedded file · {fmt(size)}</span><button type="button" className="btn btn-ghost" onClick={() => pick(r.id)}>Replace</button><button type="button" className="btn btn-ghost" onClick={() => update(r.id, { url: '' })}>Use a link instead</button></div>
                  : <label className="cs-field"><span>Link</span><TextInput value={r.url} onChange={(v) => update(r.id, { url: v })} /></label>}
                {size === null && <button type="button" className="btn btn-ghost cs-inline" onClick={() => pick(r.id)}>Upload a file instead</button>}
              </div>
              <button type="button" className="cs-icon-btn danger" aria-label={`Remove ${r.title}`} title="Remove"
                onClick={() => mutate((p) => { if (p.resources) p.resources = p.resources.filter((x) => x.id !== r.id); })}><Lucide name="trash-2" size={15} /></button>
            </div>
          );
        })}
      </div>
      <p className="cs-note">Files are embedded in the published course and count toward its size. Links need a connection.</p>
    </>
  );
}

// --------------------------------------------------------------- glossary
function GlossarySection() {
  const glossary = useProjectStore((s) => s.project.glossary) ?? [];
  const mutate = useProjectStore((s) => s.mutate);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const add = () => mutate((p) => { p.glossary = [...(p.glossary ?? []), { id: uid('gls'), term: 'Term', definition: '' }]; });
  const update = (id: string, patch: Partial<{ term: string; definition: string }>) =>
    mutate((p) => { const g = p.glossary?.find((x) => x.id === id); if (g) Object.assign(g, patch); });
  const parsed = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(.+?)\s*(?:\t|:| - | – | — )\s*(.+)$/.exec(l);
    return m ? { term: m[1].trim(), definition: m[2].trim() } : { term: l, definition: '' };
  });
  const importPaste = () => {
    mutate((p) => { p.glossary = [...(p.glossary ?? []), ...parsed.map((t) => ({ id: uid('gls'), ...t }))]; });
    setText(''); setPasting(false);
  };
  const pasteBox = pasting && (
    <div className="cs-card cs-paste">
      <label className="cs-field"><span>One term per line: "Term: definition" or "Term - definition"</span>
        <textarea className="input textarea" rows={5} value={text} autoFocus onChange={(e) => setText(e.target.value)} placeholder={'Phishing: A fake message that tries to trick you.\nSpoofing - Faking the sender of a message.'} />
      </label>
      <div className="cs-paste-actions">
        <span className="cs-note">{parsed.length} term{parsed.length === 1 ? '' : 's'} found</span>
        <button type="button" className="btn" onClick={() => { setPasting(false); setText(''); }}>Cancel</button>
        <button type="button" className="btn btn-accent" disabled={!parsed.length} onClick={importPaste}>Add {parsed.length || ''} term{parsed.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  );
  if (!glossary.length) {
    return (
      <>
        <Empty
          icon="book-open" title="No terms yet"
          body="Define the words your learners might not know. They can open the list from the Glossary button on any slide."
          example={<><b>Example · what learners see</b><div className="cs-ghost col"><i>Phishing</i><span>A fake message that tries to trick you into giving something away.</span></div><div className="cs-ghost col"><i>Spoofing</i><span>Faking the sender of a message so it looks trustworthy.</span></div></>}
        >
          <button type="button" className="btn btn-accent" onClick={add}><Lucide name="plus" size={14} /> Add term</button>
          <button type="button" className="btn" onClick={() => setPasting(true)}>Paste a list</button>
        </Empty>
        {pasteBox}
      </>
    );
  }
  return (
    <>
      <div className="cs-toolbar">
        <span className="cs-label">Shown in the player's Glossary panel</span>
        <span className="cs-toolbar-actions">
          <button type="button" className="btn" onClick={add}><Lucide name="plus" size={14} /> Add term</button>
          <button type="button" className="btn" onClick={() => setPasting(true)}>Paste a list</button>
        </span>
      </div>
      {pasteBox}
      <div className="cs-list">
        {glossary.map((g) => (
          <div key={g.id} className="cs-item">
            <div className="cs-item-fields">
              <label className="cs-field"><span>Term</span><TextInput value={g.term} onChange={(v) => update(g.id, { term: v })} /></label>
              <label className="cs-field"><span>Definition</span>
                <textarea className="input textarea" rows={2} value={g.definition} onChange={(e) => update(g.id, { definition: e.target.value })} />
              </label>
            </div>
            <button type="button" className="cs-icon-btn danger" aria-label={`Remove ${g.term}`} title="Remove"
              onClick={() => mutate((p) => { if (p.glossary) p.glossary = p.glossary.filter((x) => x.id !== g.id); })}><Lucide name="trash-2" size={15} /></button>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ banks
function BanksSection() {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const banks = project.banks ?? [];
  const quizSlides = project.slides.filter((s) => !s.lightbox && s.layers.some((l) => walk(l.blocks).some((b) => (GRADED_BLOCK_TYPES as readonly string[]).includes(b.type))));
  const newBank = (slideIds: string[]) => mutate((p) => { p.banks = [...(p.banks ?? []), { id: uid('bank'), name: `Bank ${(p.banks?.length ?? 0) + 1}`, slideIds, draw: 0, shuffle: slideIds.length > 1 }]; });
  if (!banks.length) {
    return (
      <Empty
        icon="shuffle" title="No question banks yet"
        body="A bank is a pool of slides. Each learner gets a random set from it, so every attempt is different. The score counts only the questions a learner was given."
        example={<><b>Example · a bank</b><div className="cs-ghost"><i>Red flags</i><span>draw 3 of 8</span></div></>}
      >
        <button type="button" className="btn btn-accent" onClick={() => newBank([])}><Lucide name="plus" size={14} /> New bank</button>
        {quizSlides.length > 0 && (
          <button type="button" className="btn" onClick={() => newBank(quizSlides.map((s) => s.id))}>
            Start from this course's {quizSlides.length} quiz slide{quizSlides.length === 1 ? '' : 's'}
          </button>
        )}
      </Empty>
    );
  }
  return <div className="cs-banks"><BanksEditor /></div>;
}

// ------------------------------------------------------------------ shell
const SECTIONS: { id: CourseSettingsSection; label: string; icon: string }[] = [
  { id: 'theme', label: 'Theme', icon: 'sliders-horizontal' },
  { id: 'player', label: 'Player', icon: 'app-window' },
  { id: 'resources', label: 'Resources', icon: 'file-text' },
  { id: 'glossary', label: 'Glossary', icon: 'book-open' },
  { id: 'banks', label: 'Question banks', icon: 'shuffle' }
];

export function CourseSettingsDialog() {
  const section = useUiStore((s) => s.courseSettings);
  const setSection = useUiStore((s) => s.setCourseSettings);
  const project = useProjectStore((s) => s.project);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, !!section);
  useEffect(() => {
    if (!section) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setSection(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section, setSection]);
  if (!section) return null;
  const counts: Partial<Record<CourseSettingsSection, number>> = {
    resources: project.resources?.length ?? 0, glossary: project.glossary?.length ?? 0, banks: project.banks?.length ?? 0
  };
  return (
    <div className="cs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSection(null); }}>
      <div className="cs-root" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cs-head">
          <div className="cs-head-text">
            <h2 id={titleId}>Course settings</h2>
            <p>{project.title} · {project.slides.length} slide{project.slides.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="cs-icon-btn" aria-label="Close" title="Close" onClick={() => setSection(null)}><Lucide name="x" size={18} /></button>
        </div>
        <div className="cs-main">
          <nav className="cs-nav" aria-label="Course settings sections">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" className={`cs-nav-item${section === s.id ? ' active' : ''}`} aria-current={section === s.id ? 'page' : undefined} onClick={() => setSection(s.id)}>
                <Lucide name={s.icon} size={16} /><span>{s.label}</span>
                {counts[s.id] !== undefined && <span className="cs-count">{counts[s.id]}</span>}
              </button>
            ))}
          </nav>
          <div className="cs-body" key={section}>
            {section === 'theme' && <ThemeSection />}
            {section === 'player' && <PlayerSection />}
            {section === 'resources' && <ResourcesSection />}
            {section === 'glossary' && <GlossarySection />}
            {section === 'banks' && <BanksSection />}
          </div>
        </div>
        <div className="cs-foot">
          <span>Changes apply as you make them · Ctrl+Z to undo</span>
          <button type="button" className="btn btn-accent cs-done" onClick={() => setSection(null)}>Done</button>
        </div>
      </div>
    </div>
  );
}
