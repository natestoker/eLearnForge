const icons = require('./icons.json');
for (const [k, v] of Object.entries(icons)) {
    if (k.includes('Animated SVG')) {
        const textMatch = v.match(/<text[^>]*>(.*?)<\/text>/i);
        console.log(k, '=>', textMatch ? textMatch[1] : 'no text');
    }
}
