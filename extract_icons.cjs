const fs = require('fs');
const https = require('https');

const data = fs.readFileSync('C:\\Users\\nates\\.gemini\\antigravity\\brain\\e592782d-74b8-479d-b817-7b528df384e3\\.system_generated\\steps\\768\\output.txt', 'utf8');
const screens = JSON.parse(data.trim().replace(/^\d+:\s*/gm, '')).screens;

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function main() {
  const icons = {};
  for (const screen of screens) {
    if (screen.title.includes('Animation Icon') || screen.title.includes('Animated SVG')) {
      if (screen.htmlCode && screen.htmlCode.downloadUrl) {
        console.log(`Downloading ${screen.title}...`);
        try {
          const html = await fetchHtml(screen.htmlCode.downloadUrl);
          const match = html.match(/<svg[\s\S]*?<\/svg>/i);
          if (match) {
            icons[screen.title] = match[0];
          } else {
            // Might be an icon in a div
            const divMatch = html.match(/<div[^>]*class="[^"]*material-symbols-outlined[^"]*"[^>]*>.*?<\/div>/i);
            if (divMatch) {
              icons[screen.title] = divMatch[0];
            } else {
                icons[screen.title] = html; // Save everything if no SVG found
            }
          }
        } catch (e) {
          console.error(`Failed to download ${screen.title}:`, e.message);
        }
      }
    }
  }
  fs.writeFileSync('icons.json', JSON.stringify(icons, null, 2));
  console.log('Saved icons.json');
}

main();
