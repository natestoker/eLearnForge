import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { RuntimeRendererProps } from '../blockApi';
import type { CodeProps } from '../../schema/types';

// Runtime code block. Author JS runs in-page (the author is trusted; this
// is the same power Storyline's Execute JavaScript grants) inside an IIFE
// with a scoped API. CSS is prefixed to the block wrapper so styles cannot
// leak into the course chrome.

export function CodeRuntime({ block, runtime }: RuntimeRendererProps) {
  const props = block.props as CodeProps;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = props.html || '';

    let style: HTMLStyleElement | null = null;
    if (props.css) {
      style = document.createElement('style');
      const scope = `[data-code-block="${block.id}"]`;
      // Naive but effective scoping: prefix each top-level selector.
      style.textContent = props.css.replace(
        /(^|\})\s*([^@{}][^{]*)\{/g,
        (_m, brace, sel) => `${brace} ${sel.split(',').map((s: string) => `${scope} ${s.trim()}`).join(', ')} {`
      );
      document.head.appendChild(style);
    }

    const offs: Array<() => void> = [];
    const forge = {
      setVariable: (name: string, value: string | number | boolean) => runtime.setVariableByName(name, value),
      getVariable: (name: string) => {
        const v = runtime.project.variables.find((vr) => vr.name === name);
        return v ? runtime.variableById(v.id) : undefined;
      },
      onVariableChange: (fn: (name: string, value: unknown) => void) => {
        let prev: Record<string, unknown> = { ...runtime.getSnapshot().variables };
        const off = runtime.subscribe(() => {
          const now = runtime.getSnapshot().variables;
          for (const v of runtime.project.variables) {
            if (now[v.id] !== prev[v.id]) fn(v.name, now[v.id]);
          }
          prev = { ...now };
        });
        offs.push(off);
      },
      complete: () => runtime.completeCourse(),
      goToSlide: (n: number) => {
        const s = runtime.project.slides[n - 1];
        if (s) runtime.enterSlide(s.id);
      }
    };

    if (props.js) {
      try {
        // IIFE-wrapped per house convention; root/forge/gsap in scope.
        const fn = new Function('root', 'forge', 'gsap', `(function () {\n${props.js}\n})();`);
        fn(root, forge, gsap);
      } catch (err) {
        console.error('eLearnForge code block error', err);
        root.innerHTML = `<div style="font:12px monospace;color:#c0392b;padding:8px">Code block error: ${String(err)}</div>`;
      }
    }

    return () => {
      offs.forEach((off) => off());
      style?.remove();
      gsap.killTweensOf(root.querySelectorAll('*'));
      root.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  return <div ref={rootRef} data-code-block={block.id} className="code-runtime" />;
}
