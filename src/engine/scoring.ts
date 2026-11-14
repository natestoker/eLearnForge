import type { Block, Project } from '../schema/types';

// Scoring helpers shared by the runtime and the Publish dialog.
//
// "Graded" blocks are the ones that have a single right/wrong outcome and
// report it through runtime.reportInteraction. Scenario is left out on
// purpose: it reports on reaching an ending, not on a correct answer.

export const GRADED_BLOCK_TYPES = [
  'multipleChoice', 'fillBlank', 'dragDrop', 'sequence', 'matching'
] as const;

export const DEFAULT_PASSING_SCORE = 80;

function walk(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.type === 'group' ? [b, ...walk((b.props as { blocks: Block[] }).blocks)] : [b]
  );
}

export function gradedBlockIds(project: Project): string[] {
  const ids: string[] = [];
  for (const slide of project.slides) {
    for (const layer of slide.layers) {
      for (const b of walk(layer.blocks)) {
        if ((GRADED_BLOCK_TYPES as readonly string[]).includes(b.type)) ids.push(b.id);
      }
    }
  }
  return ids;
}

export function passingScoreOf(project: Project): number {
  const n = project.completion?.passingScore;
  return typeof n === 'number' && isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_PASSING_SCORE;
}

// True when finishing the course depends on the score.
export function completionNeedsPass(project: Project): boolean {
  const m = project.completion?.mode;
  return m === 'passed' || m === 'viewedAndPassed';
}
