import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CanvasRendererProps } from '../blockApi';
import type { TextProps } from '../../schema/types';
import { ensureFont } from '../../shared/fonts';

// Inline rich text via contentEditable with a small formatting toolbar.
// Double-click to edit; a floating toolbar offers bold/italic/underline,
// lists, and links through document.execCommand (adequate for course copy
// and keeps the block a lightweight island of HTML). Blur commits as one
// undo step.

export function textStyle(props: TextProps): CSSProperties {
  if (props.fontFamily) ensureFont(props.fontFamily);
  const valign = props.valign ?? 'top';
  return {
    fontSize: props.fontSize,
    color: props.color || undefined,
    fontWeight: props.bold ? 700 : undefined,
    fontFamily: props.fontFamily ? `'${props.fontFamily}', var(--mono)` : undefined,
    textAlign: props.align,
    width: '100%',
    height: '100%',
    // PowerPoint model: text boxes do NOT clip - text taller than the box
    // simply paints past it. Hidden overflow was cutting imported decks off
    // mid-line. The author can still opt into a scrollbox via "Scroll
    // overflow".
    overflowY: props.scroll ? 'auto' : 'visible',
    overflowX: props.scroll ? 'hidden' : 'visible',
    lineHeight: props.lineHeight ?? 1.35,
    letterSpacing: props.letterSpacing ? `${props.letterSpacing}px` : undefined,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center'
  };
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function TextCanvas({ block, onUpdateProps }: CanvasRendererProps) {
  const props = block.props as TextProps;
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.innerHTML = props.html;
      ref.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const html = ref.current?.innerHTML ?? props.html;
    onUpdateProps((p: TextProps) => { p.html = html; });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="text-edit-wrap" style={{ width: '100%', height: '100%' }}>
        {/* Toolbar uses onMouseDown+preventDefault so the selection in the
            editable is not lost when a button is pressed. */}
        <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => exec('bold')} title="Bold"><b>B</b></button>
          <button onClick={() => exec('italic')} title="Italic"><i>I</i></button>
          <button onClick={() => exec('underline')} title="Underline"><u>U</u></button>
          <span className="rte-sep" />
          <button onClick={() => exec('insertUnorderedList')} title="Bulleted list">{'\u2022'}</button>
          <button onClick={() => exec('insertOrderedList')} title="Numbered list">1.</button>
          <span className="rte-sep" />
          <button onClick={() => exec('justifyLeft')} title="Align left">{'\u2190'}</button>
          <button onClick={() => exec('justifyCenter')} title="Center">{'\u2194'}</button>
          <button onClick={() => exec('justifyRight')} title="Align right">{'\u2192'}</button>
          <span className="rte-sep" />
          <button
            onClick={() => {
              const url = window.prompt('Link URL');
              if (url) exec('createLink', url);
            }}
            title="Link"
          >{'\u{1F517}'}</button>
          <button onClick={() => exec('removeFormat')} title="Clear formatting">{'\u2717'}</button>
        </div>
        <div
          ref={ref}
          className="text-block editing"
          style={textStyle(props)}
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onBlur={commit}
        />
      </div>
    );
  }

  return (
    <div
      className="text-block"
      style={textStyle(props)}
      onDoubleClick={() => setEditing(true)}
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}
