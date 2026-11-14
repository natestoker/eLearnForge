import type { Runtime } from './runtime';

// The small scripting API handed to author JavaScript: Code blocks and the
// Execute JavaScript trigger action. Author code is trusted (same power as
// Storyline's Execute JavaScript), so this is convenience, not a sandbox.
export interface Forge {
  setVariable(name: string, value: string | number | boolean): void;
  getVariable(name: string): string | number | boolean | undefined;
  complete(): void;
  goToSlide(n: number): void; // 1-based
  nextSlide(): void;
  prevSlide(): void;
}

export function createForge(runtime: Runtime): Forge {
  return {
    setVariable: (name, value) => runtime.setVariableByName(name, value),
    getVariable: (name) => {
      const v = runtime.project.variables.find((vr) => vr.name === name);
      return v ? runtime.variableById(v.id) : undefined;
    },
    complete: () => runtime.completeCourse(),
    goToSlide: (n) => {
      const s = runtime.project.slides[n - 1];
      if (s) runtime.enterSlide(s.id);
    },
    nextSlide: () => runtime.stepSlide(1),
    prevSlide: () => runtime.stepSlide(-1)
  };
}

// Runs author code with `forge` and `gsap` in scope. Errors are logged, never
// thrown: a typo in a script must not break the course.
export function runAuthorJs(code: string, forge: Forge, gsap: unknown): void {
  try {
    new Function('forge', 'gsap', `(function () {\n${code}\n})();`)(forge, gsap);
  } catch (err) {
    console.error('eLearnForge Execute JavaScript error', err);
  }
}
