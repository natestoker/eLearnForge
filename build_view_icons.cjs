const fs = require('fs');
const icons = JSON.parse(fs.readFileSync('C:\\Users\\nates\\.gemini\\antigravity\\worktrees\\eLearnForge\\frozen-cosmos-springs-18h20\\icons.json', 'utf8'));

let md = `# Unnamed Icons Review\n\nI found 16 unnamed \`Animated SVG\` files in Stitch. Please look at the grid below and tell me which one corresponds to Zoom In, Zoom Out, Fade, Fly In, Split, Wipe, etc.\n\n<div style="display: flex; flex-wrap: wrap; background: #131313; color: white; padding: 20px;">\n`;
for (const [name, svg] of Object.entries(icons)) {
    if (name.includes('Animated SVG')) {
        md += `  <div style="padding: 20px; text-align: center; width: 120px;">
    <div style="width: 64px; height: 64px; margin: 0 auto;">
      ${svg.replace(/class="[^"]*"/g, '').replace(/<svg/g, '<svg width="100%" height="100%"')}
    </div>
    <div style="font-size: 12px; margin-top: 10px; font-weight: bold;">${name}</div>
  </div>\n`;
    }
}
md += `</div>\n`;

fs.writeFileSync('C:\\Users\\nates\\.gemini\\antigravity\\brain\\e592782d-74b8-479d-b817-7b528df384e3\\view_icons.md', md);
