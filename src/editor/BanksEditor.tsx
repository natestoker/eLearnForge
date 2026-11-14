import { uid } from '../schema/factory';
import { useProjectStore } from '../state/projectStore';
import { CheckboxInput, Field, NumberInput, TextInput } from './fields';
import { Lucide } from './lucide';

// Question banks: pick which slides belong to a pool, how many each learner
// gets, and whether they come in random order. The draw is made per learner
// when the course starts and is saved with their progress.
export function BanksEditor() {
  const project = useProjectStore((s) => s.project);
  const mutate = useProjectStore((s) => s.mutate);
  const banks = project.banks ?? [];
  const slides = project.slides.filter((s) => !s.lightbox);

  const edit = (id: string, fn: (b: NonNullable<typeof project.banks>[number]) => void, history = true) =>
    mutate((p) => { const b = p.banks?.find((x) => x.id === id); if (b) fn(b); }, history);

  return (
    <div>
      <p className="hint">
        A bank is a pool of slides. Each learner gets a random selection from it, so two people
        taking the course see different questions. The score counts only the questions a learner
        was given, and a resumed course shows the same ones.
      </p>
      {banks.length === 0 && <p className="empty-note">No banks yet.</p>}
      {banks.map((bank) => {
        const members = new Set(bank.slideIds);
        const inCourse = bank.slideIds.filter((id) => slides.some((s) => s.id === id)).length;
        return (
          <div key={bank.id} className="variable-card bank-card">
            <div className="trigger-row">
              <TextInput value={bank.name} onChange={(v) => edit(bank.id, (b) => { b.name = v; }, false)} />
              <button
                type="button" className="btn btn-ghost btn-icon btn-danger" title="Delete this bank (its slides stay in the course)" aria-label="Delete bank"
                onClick={() => mutate((p) => { p.banks = (p.banks ?? []).filter((b) => b.id !== bank.id); })}
              ><Lucide name="trash-2" size={14} /></button>
            </div>
            <Field label="Slides each learner gets">
              <NumberInput value={bank.draw} min={0} max={Math.max(inCourse, 1)} onChange={(v) => edit(bank.id, (b) => { b.draw = Math.max(0, Math.floor(v)); }, false)} />
            </Field>
            <p className="hint">0 means all {inCourse} of them. Now: {bank.draw > 0 && bank.draw < inCourse ? `${bank.draw} of ${inCourse}` : `all ${inCourse}`}.</p>
            <CheckboxInput label="Show them in random order" checked={bank.shuffle} onChange={(v) => edit(bank.id, (b) => { b.shuffle = v; })} />
            <div className="check-list bank-slides">
              {slides.map((s, i) => {
                const owner = banks.find((o) => o.id !== bank.id && o.slideIds.includes(s.id));
                return (
                  <label key={s.id} className="check-item" title={owner ? `Already in ${owner.name}` : undefined}>
                    <input
                      type="checkbox"
                      disabled={!!owner}
                      checked={members.has(s.id)}
                      onChange={(e) => edit(bank.id, (b) => {
                        const set = new Set(b.slideIds);
                        if (e.target.checked) set.add(s.id); else set.delete(s.id);
                        b.slideIds = project.slides.filter((x) => set.has(x.id)).map((x) => x.id);
                      })}
                    />
                    {i + 1}. {s.name}{owner ? ` (in ${owner.name})` : ''}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <button
        type="button" className="btn btn-accent"
        onClick={() => mutate((p) => { p.banks = [...(p.banks ?? []), { id: uid('bank'), name: `Bank ${(p.banks?.length ?? 0) + 1}`, slideIds: [], draw: 0, shuffle: false }]; })}
      >+ New bank</button>
    </div>
  );
}
