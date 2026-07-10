import type { RuntimeRendererProps } from '../blockApi';
import type { VarDisplayProps } from '../../schema/types';

// Live stat tile. The Player re-renders every block on runtime changes, so a
// plain resolveReference read here stays current as variables move.
export function VarDisplayRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as VarDisplayProps;
  const value = runtime.resolveReference(props.reference) ?? '—';
  return (
    <div className={`vd-block live ${props.tile ? 'tile' : ''}`} style={{ textAlign: props.align }}>
      <span className="vd-value" style={{ fontSize: props.fontSize, color: props.color || undefined }}>
        {props.prefix}{value}{props.suffix}
      </span>
      {props.label && <span className="vd-label">{props.label}</span>}
    </div>
  );
}
