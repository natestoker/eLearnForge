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

// The outer box handles sizing, overflow, and VERTICAL alignment (a flex
// column). The text content itself lives in a separate inner element
// (textContentStyle) so that inline word/letter spans injected for text
// animations flow horizontally - if they were direct children of the flex
// column, each word became a flex item on its own line.
export function textStyle(props: TextProps): CSSProperties {
  if (props.fontFamily) ensureFont(props.fontFamily);
  const valign = props.valign ?? 'top';
  return {
    width: '100%',
    height: '100%',
    overflowY: props.scroll ? 'auto' : 'visible',
    overflowX: props.scroll ? 'hidden' : 'visible',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: valign === 'top' ? 'flex-start' : valign === 'bottom' ? 'flex-end' : 'center'
  };
}

export function textContentStyle(props: TextProps): CSSProperties {
  if (props.fontFamily) ensureFont(props.fontFamily);
  return {
    fontSize: props.fontSize,
    color: props.color || undefined,
    fontWeight: props.fontWeight ?? (props.bold ? 700 : undefined),
    fontFamily: props.fontFamily ? `'${props.fontFamily}', var(--mono)` : undefined,
    textAlign: props.align,
    width: '100%',
    lineHeight: props.lineHeight ?? 1.35,
    letterSpacing: props.letterSpacing ? `${props.letterSpacing}px` : undefined
  };
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

// Rewrite presentational tags the browser's execCommand emits into the
// semantic equivalents so exported/authored HTML uses correct elements:
// <b>->'<strong>', <i>->'<em>', <font>-color spans stay as-is. Runs once on
// commit so editing stays fast.
function toSemanticHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const swap = (from: string, to: string) => {
    tmp.querySelectorAll(from).forEach((el) => {
      const rep = document.createElement(to);
      while (el.firstChild) rep.appendChild(el.firstChild);
      for (const a of Array.from(el.attributes)) rep.setAttribute(a.name, a.value);
      el.replaceWith(rep);
    });
  };
  swap('b', 'strong');
  swap('i', 'em');
  return tmp.innerHTML;
}

export function TextCanvas({ block, onUpdateProps }: CanvasRendererProps) {
  const props = block.props as TextProps;
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The selection inside the editable, saved on every keyboard/mouse move.
  // The format <select> steals focus when opened, collapsing the live
  // selection, so we restore this range before applying formatBlock.
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.innerHTML = props.html;
      ref.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreRange = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // Wrap the current block in a semantic tag (P, H1..H6). formatBlock needs a
  // live selection inside the editable, so refocus + restore first.
  const setBlockTag = (tag: string) => {
    if (!tag) return;
    ref.current?.focus();
    restoreRange();
    exec('formatBlock', tag);
  };

  const commit = () => {
    const html = toSemanticHtml(ref.current?.innerHTML ?? props.html);
    onUpdateProps((p: TextProps) => { p.html = html; });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="text-edit-wrap" style={{ width: '100%', height: '100%' }}>
        {/* Toolbar uses onMouseDown+preventDefault so the selection in the
            editable is not lost when a button is pressed. */}
        <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}>
          {/* Block-level semantic tag. The <select> takes focus (unlike the
              mousedown-prevented buttons), so onBlur below is guarded to not
              commit when focus lands on the toolbar. */}
          <select
            className="rte-select"
            defaultValue=""
            title="Paragraph / heading style"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { setBlockTag(e.target.value); e.target.selectedIndex = 0; }}
          >
            <option value="" disabled>Style…</option>
            <option value="P">Paragraph</option>
            <option value="H1">Heading 1</option>
            <option value="H2">Heading 2</option>
            <option value="H3">Heading 3</option>
            <option value="H4">Heading 4</option>
            <option value="H5">Heading 5</option>
            <option value="H6">Heading 6</option>
          </select>
          <span className="rte-sep" />
          <button onClick={() => exec('bold')} title="Strong (bold)"><b>B</b></button>
          <button onClick={() => exec('italic')} title="Emphasis (italic)"><i>I</i></button>
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
          // Editing is a single element: merge outer + content styling, and
          // override justify to top so the caret starts sensibly.
          style={{ ...textStyle(props), ...textContentStyle(props), justifyContent: 'flex-start' }}
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={saveRange}
          onMouseUp={saveRange}
          onBlur={(e) => {
            // Interacting with the toolbar (the format select) blurs the
            // editable; don't commit/teardown while focus is still inside our
            // own edit wrapper.
            const wrap = e.currentTarget.closest('.text-edit-wrap');
            if (wrap && e.relatedTarget && wrap.contains(e.relatedTarget as Node)) return;
            commit();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="text-block"
      style={textStyle(props)}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="text-content" style={textContentStyle(props)} dangerouslySetInnerHTML={{ __html: props.html }} />
    </div>
  );
}
