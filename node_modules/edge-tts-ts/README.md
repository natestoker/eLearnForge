# edge-tts-ts

A TypeScript port of the [edge-tts](https://github.com/rany2/edge-tts) Python module.

This module allows you to use Microsoft Edge's online text-to-speech service from within your JavaScript/TypeScript code or using the provided `edge-tts` or `edge-playback` command.

## Features

- **Browser & Node.js Compatible**: The core logic is written to work in both environments.
- **WebSocket Communication**: Efficient streaming of audio and metadata.
- **Subtitles Support**: Generates SRT subtitles from WordBoundary/SentenceBoundary events.
- **CLI Tools**: Command-line interfaces for synthesis and playback.

## Installation

```bash
pnpm add edge-tts-ts
# or
npm install edge-tts-ts
```

### CDN Usage (Vanilla JS / Browser)

You can use the library directly in the browser via ESM-friendly CDNs like [esm.sh](https://esm.sh/):

```html
<script type="module">
  import { Communicate } from "https://esm.sh/edge-tts-ts";

  const comm = new Communicate("Hello from the CDN!", {
    voice: "en-US-EmmaMultilingualNeural"
  });

  for await (const chunk of comm.stream()) {
    if (chunk.type === "audio") {
      // Use the audio chunk
    }
  }
</script>
```

## Usage

### CLI

```bash
# List available voices
edge-tts --list-voices

# Synthesize text to MP3 and SRT
edge-tts --text "Hello, world!" --write-media hello.mp3 --write-subtitles hello.srt

# Playback immediately (requires sound-play on Node)
edge-playback --text "Hello, world!"
```

### Library (Node.js & Browser)

```typescript
import { Communicate } from "edge-tts-ts";

const comm = new Communicate("Hello world", {
	voice: "en-US-EmmaMultilingualNeural",
});

for await (const chunk of comm.stream()) {
	if (chunk.type === "audio") {
		// chunk.data is a Uint8Array
		console.log("Received audio chunk of size:", chunk.data.length);
	} else {
		// chunk.type is "WordBoundary" or "SentenceBoundary"
		console.log("Boundary:", chunk.text, "at", chunk.offset);
	}
}
```

### Browser Example

In the browser, you can use the `Communicate` class directly. You might need to handle the audio chunks and play them using the Web Audio API or by creating a `Blob` and using an `Audio` element.

```typescript
const chunks = [];
for await (const chunk of comm.stream()) {
	if (chunk.type === "audio") {
		chunks.push(chunk.data);
	}
}
const blob = new Blob(chunks, { type: "audio/mpeg" });
const url = URL.createObjectURL(blob);
const audio = new Audio(url);
audio.play();
```

## Examples

There are two examples provided in the `examples` directory:

### Node.js (CLI & Script)

Located in `examples/nodejs`. You can test the CLI functionality using the provided scripts:

- **Bash**: `bash test-cli.sh`
- **PowerShell**: `powershell ./test-cli.ps1`

These scripts will build the project and run various CLI commands to demonstrate synthesis and playback.

### Browser (React + Tailwind)

Located in `examples/browser`. This is a tiny React application that demonstrates how to use the library in a browser environment.
To run it:

```bash
cd examples/browser
pnpm install
pnpm dev
```

The app allows you to enter text, select a voice, and adjust rate/volume/pitch directly from your browser.

## Differences from Python Version

- **No SSML Removal**: This port follows the same rules as the Python version regarding SSML (it uses the same format).
- **Playback**: Uses `sound-play` on Node for cross-platform playback, or native APIs in the browser.
- **isomorphic-ws**: Uses `isomorphic-ws` to support both Node and Browser WebSockets.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
