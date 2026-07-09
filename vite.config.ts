import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
// Single-file builds sidestep every server MIME-type quirk: all JS and CSS
// are inlined, so index.html and player.html are fully self-contained.
// The plugin supports one entry per build, so we build twice, switched by
// FORGE_ENTRY. Build order matters: player FIRST, because the editor build
// bakes the finished player.html in as a string (the publish pipeline
// embeds project JSON into it and wraps it per target).
const entry = process.env.FORGE_ENTRY === 'player' ? 'player' : 'main';

function forgePlayerHtml(): Plugin {
  const virtualId = 'virtual:player-html';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'forge-player-html',
    resolveId(id) {
      return id === virtualId ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      const path = resolve(__dirname, 'dist/player.html');
      if (existsSync(path)) {
        return `export default ${JSON.stringify(readFileSync(path, 'utf-8'))};`;
      }
      // Dev mode / player not built yet: publish is disabled in the UI.
      return 'export default "";';
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), forgePlayerHtml()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  build: {
    emptyOutDir: entry === 'player',
    rollupOptions: {
      input: resolve(__dirname, entry === 'player' ? 'player.html' : 'index.html'),
      // kokoro-js is loaded from a CDN at runtime (see audioBake); never bundle it.
      external: [/^https:\/\/cdn\.jsdelivr\.net\/npm\/kokoro-js/]
    }
  }
});
