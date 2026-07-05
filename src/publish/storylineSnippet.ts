import type { Project } from '../schema/types';

// Generates the receiving-end JavaScript an author pastes into a Storyline
// "Execute JavaScript when timeline starts" trigger. It listens for the
// web object's postMessage events and pushes results into Storyline
// variables via the player SetVar API.
//
// Conventions honored: IIFE scoping, ASCII-only comments, surgical scope.

export function storylineSnippet(project: Project): string {
  const prefix = 'EF';
  return `// eLearnForge web object bridge for "${project.title.replace(/"/g, "'")}"
// Paste into a Storyline trigger: Execute JavaScript when the timeline
// starts on the slide that contains the web object.
//
// Create these Storyline variables first (Text unless noted):
//   ${prefix}_Complete   (True/False, default False)
//   ${prefix}_Score      (Number, default 0)
//   ${prefix}_LastAnswer (Text)
//   ${prefix}_LastCorrect (True/False, default False)
//   ${prefix}_SlideIndex (Number, default 0)
//
// Then add Storyline triggers that react to those variables changing,
// for example: show layer Complete when ${prefix}_Complete changes to True.

(function () {
  // Guard against double-binding when the learner revisits the slide.
  if (window.__efBridgeBound) return;
  window.__efBridgeBound = true;

  var player = GetPlayer();

  window.addEventListener('message', function (msg) {
    var data = msg && msg.data;
    if (!data || data.source !== 'elearnforge') return;
    var p = data.payload || {};
    try {
      switch (data.event) {
        case 'slideViewed':
          player.SetVar('${prefix}_SlideIndex', Number(p.index) || 0);
          break;
        case 'interaction':
          player.SetVar('${prefix}_LastAnswer', String(p.response || ''));
          player.SetVar('${prefix}_LastCorrect', !!p.correct);
          break;
        case 'scored':
          player.SetVar('${prefix}_Score', Number(p.score) || 0);
          break;
        case 'completed':
          player.SetVar('${prefix}_Complete', true);
          break;
      }
    } catch (e) {
      // A missing variable must never break the course; check names above.
    }
  });
})();
`;
}

export function storylineReadme(project: Project): string {
  return `eLearnForge web object - "${project.title}"
=====================================================

WHAT THIS IS
  A self-contained interaction published from eLearnForge, packaged as a
  Storyline web object. index.html is the interaction; storyline-bridge.js
  contains the trigger code that receives its results inside Storyline.

HOW TO ADD IT TO STORYLINE
  1. Unzip this package to a folder. The folder must contain index.html
     at its root (it does).
  2. In Storyline: Insert > Web Object > point at the unzipped FOLDER.
     Storyline copies the folder into the published output.
  3. Create the Storyline variables listed at the top of
     storyline-bridge.js (names and types matter).
  4. Add a trigger on the same slide:
       Execute JavaScript when the timeline starts
     and paste the full contents of storyline-bridge.js into it.
  5. Add your own triggers that react to the variables, for example:
       Show layer "Done" when EF_Complete changes to True.

WHY A WEB OBJECT HERE IS CORRECT
  Web objects are the supported container for shipping a complete external
  interaction into a course. This is different from using web objects to
  inject custom JavaScript into Storyline itself, which is better done
  with JS triggers.

NOTES
  - Test in the published output or Review 360. Web objects do not run in
    Preview inside Storyline.
  - The interaction stores its own resume state locally; completion and
    answers flow into Storyline through the bridge variables.
`;
}
