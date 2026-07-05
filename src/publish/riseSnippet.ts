import type { Project } from '../schema/types';

// Rise 360 target. Two facts drive the design (both proven in prior work):
// the Code Block - not the multimedia block - is the correct embedding
// surface for HTML/CSS/JS in Rise, and completion flows via postMessage.
// The published course file is too large to paste into a code block
// directly, so the package is: the course HTML (host it anywhere), plus a
// generated snippet that iframes it and listens for the course's
// 'completed' postMessage to mark the block complete.

export function riseSnippet(project: Project): string {
  return `<!-- eLearnForge in a Rise 360 Code Block: "${project.title.replace(/"/g, "'")}" -->
<!--
  SETUP
  1. Upload course.html (from this package) anywhere you can host a file,
     for example https://yourdomain.com/courses/${slugify(project.title)}.html
  2. Replace COURSE_URL below with that address.
  3. In Rise: add a Code Block (Blocks > Code) and paste this whole snippet.
  4. Optional: in the code block settings, enable completion tracking so
     the continue-button divider waits for the interaction.
-->
<div id="ef-wrap" style="position:relative;width:100%;aspect-ratio:16/9;background:#0d1015;border-radius:12px;overflow:hidden">
  <iframe
    id="ef-frame"
    src="COURSE_URL"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"
    allow="autoplay"
    title="${project.title.replace(/"/g, "'")}">
  </iframe>
</div>
<script>
  // Bridge: the course posts { source: 'elearnforge', event: 'completed' }
  // when its completion rule is met. Rise code blocks complete via the
  // block-completion postMessage contract.
  (function () {
    if (window.__efRiseBound) return;
    window.__efRiseBound = true;
    window.addEventListener('message', function (msg) {
      var d = msg && msg.data;
      if (!d || d.source !== 'elearnforge') return;
      if (d.event === 'completed') {
        // Signal Rise that this code block is complete.
        window.parent.postMessage({ type: 'BLOCK_COMPLETED' }, '*');
      }
    });
  })();
</script>
`;
}

function slugify(s: string): string {
  const c = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return c || 'course';
}

export function riseReadme(project: Project): string {
  return `eLearnForge for Rise 360 - "${project.title}"
====================================================

CONTENTS
  course.html            The complete interaction (self-contained).
  rise-code-block.html   The snippet to paste into a Rise Code Block.

STEPS
  1. Host course.html somewhere reachable by your learners (your site, a
     CDN, SharePoint with an HTML-friendly library, etc). Rise content is
     served over https, so the course URL must be https too.
  2. Open rise-code-block.html in a text editor, replace COURSE_URL with
     the hosted address.
  3. In Rise: Blocks > Code, paste the whole snippet.

COMPLETION
  The course fires a postMessage ({ source: 'elearnforge', event:
  'completed' }) when its completion rule is met (all slides viewed, or
  the Complete course trigger action). The snippet relays that to Rise's
  code block completion signal. If your Rise version uses a different
  completion contract for code blocks, adjust the single
  window.parent.postMessage line at the bottom of the snippet.

NOTE
  The course targets the 'storyline' message contract internally, so the
  same file also works as a Storyline web object without re-publishing.
`;
}
