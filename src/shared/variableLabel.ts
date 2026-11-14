import type { Block, Project, Variable } from '../schema/types';
import { blockDisplayName } from './blockName';

// Blocks create helper variables named after their id, like
// mc_blk_nhuf5di8xm_correct. They have to keep that name (the player looks
// them up by it), so the editor shows a readable label instead:
// "Knowledge check: correct". Variables the author made are shown as typed.

const AUTO = /^[a-z]+_(blk_[a-z0-9]+)_([a-z]+)$/i;

function findBlock(project: Project, id: string): Block | null {
  const visit = (blocks: Block[]): Block | null => {
    for (const b of blocks) {
      if (b.id === id) return b;
      if (b.type === 'group') {
        const hit = visit((b.props as { blocks: Block[] }).blocks);
        if (hit) return hit;
      }
    }
    return null;
  };
  for (const s of project.slides) for (const l of s.layers) { const hit = visit(l.blocks); if (hit) return hit; }
  return null;
}

// The block an auto-created variable belongs to, or null for any other variable.
export function variableOwner(project: Project, v: Variable): { block: Block; what: string } | null {
  const m = AUTO.exec(v.name);
  if (!m) return null;
  const block = findBlock(project, m[1]);
  return block ? { block, what: m[2] } : null;
}

export function variableLabel(project: Project, v: Variable): string {
  const owner = variableOwner(project, v);
  return owner ? `${blockDisplayName(owner.block)}: ${owner.what}` : v.name;
}
