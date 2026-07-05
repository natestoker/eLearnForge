import type { PropertiesRendererProps } from '../blockApi';
import type { MultipleChoiceProps } from '../../schema/types';
import { CheckboxInput, Field, TextArea, TextInput } from '../../editor/fields';
import { mcVariableName, uid } from '../../schema/factory';

export function MultipleChoiceProperties({ block, onUpdateProps }: PropertiesRendererProps) {
  const props = block.props as MultipleChoiceProps;

  return (
    <>
      <Field label="Question">
        <TextArea
          value={props.question}
          rows={3}
          onChange={(v) => onUpdateProps((p: MultipleChoiceProps) => { p.question = v; })}
        />
      </Field>

      <Field label="Choices">
        <div className="mc-editor-choices">
          {props.choices.map((c, i) => (
            <div key={c.id} className="mc-editor-choice">
              <input
                type={props.allowMultiple ? 'checkbox' : 'radio'}
                title="Mark as correct"
                checked={props.correctChoiceIds.includes(c.id)}
                onChange={(e) =>
                  onUpdateProps((p: MultipleChoiceProps) => {
                    if (p.allowMultiple) {
                      p.correctChoiceIds = e.target.checked
                        ? [...p.correctChoiceIds, c.id]
                        : p.correctChoiceIds.filter((id) => id !== c.id);
                    } else {
                      p.correctChoiceIds = [c.id];
                    }
                  })
                }
              />
              <input
                className="input"
                type="text"
                value={c.text}
                onChange={(e) =>
                  onUpdateProps((p: MultipleChoiceProps) => {
                    p.choices[i].text = e.target.value;
                  })
                }
              />
              <button
                className="btn btn-ghost btn-icon"
                title="Remove choice"
                disabled={props.choices.length <= 2}
                onClick={() =>
                  onUpdateProps((p: MultipleChoiceProps) => {
                    p.choices.splice(i, 1);
                    p.correctChoiceIds = p.correctChoiceIds.filter((id) => id !== c.id);
                  })
                }
              >
                x
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost"
            onClick={() =>
              onUpdateProps((p: MultipleChoiceProps) => {
                p.choices.push({ id: uid('ch'), text: `Choice ${p.choices.length + 1}` });
              })
            }
          >
            + Add choice
          </button>
        </div>
      </Field>

      <CheckboxInput
        checked={props.allowMultiple}
        label="Allow multiple answers"
        onChange={(v) =>
          onUpdateProps((p: MultipleChoiceProps) => {
            p.allowMultiple = v;
            if (!v && p.correctChoiceIds.length > 1) {
              p.correctChoiceIds = p.correctChoiceIds.slice(0, 1);
            }
          })
        }
      />

      <Field label="Feedback (correct)">
        <TextInput
          value={props.feedbackCorrect}
          onChange={(v) => onUpdateProps((p: MultipleChoiceProps) => { p.feedbackCorrect = v; })}
        />
      </Field>
      <Field label="Feedback (incorrect)">
        <TextInput
          value={props.feedbackIncorrect}
          onChange={(v) => onUpdateProps((p: MultipleChoiceProps) => { p.feedbackIncorrect = v; })}
        />
      </Field>

      <p className="hint">
        On submit this block sets <code>{mcVariableName(block.id)}</code> (true/false).
        Wire an "on variable change" trigger to it to react.
      </p>
    </>
  );
}
