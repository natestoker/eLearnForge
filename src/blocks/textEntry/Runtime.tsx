import type { RuntimeRendererProps } from '../blockApi';
import type { TextEntryProps } from '../../schema/types';
import { textEntryVariableName } from '../../schema/factory';

export function TextEntryRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as TextEntryProps;
  const varName = textEntryVariableName(block.id);
  const common = {
    placeholder: props.placeholder,
    style: { width: '100%', height: '100%', fontSize: props.fontSize },
    className: 'text-entry-input',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      runtime.setVariableByName(varName, e.target.value),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation()
  };
  return props.multiline ? <textarea {...common} /> : <input type="text" {...common} />;
}
