# @poof-bg/js

Official TypeScript/JavaScript SDK for the [Poof](https://poof.bg) [background removal API](https://poof.bg/background-removal-api): images and [video](https://poof.bg/video-background-removal-api).

Migrating from remove.bg? It shuts down on 1 December 2026 — see the [remove.bg alternative and migration guide](https://poof.bg/alternative/remove-bg).

## Installation

```bash
npm install @poof-bg/js
# or
yarn add @poof-bg/js
# or
pnpm add @poof-bg/js
```

## Quick Start

```typescript
import { Poof } from '@poof-bg/js';

const poof = new Poof({ apiKey: 'your-api-key' });

// Remove background from an image
const result = await poof.removeBackground(imageFile);

// result.data is an ArrayBuffer containing the processed image
// result.metadata contains processing info

// Remove background from a video (returns a job; wait for the result)
const done = await poof.removeBackground(videoFile, { wait: true });
// done.resultUrl is a direct download link to the transparent WebM
```

## Usage

### Basic Background Removal

```typescript
import { Poof } from '@poof-bg/js';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

// From File (browser)
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const result = await poof.removeBackground(file);

// Create a Blob for display
const blob = new Blob([result.data], { type: result.metadata.contentType });
const url = URL.createObjectURL(blob);
```

### With Options

```typescript
const result = await poof.removeBackground(file, {
  format: 'webp',      // Output format: 'png' | 'jpg' | 'webp'
  crop: true,          // Crop to subject bounds, or an aspect ratio like '1:1'
  padding: '10%',      // Padding around the subject when cropping
  size: 'medium',      // Size preset: 'full' | 'preview' | 'medium' | 'hd'
  channels: 'rgb',     // 'rgba' for transparency, 'rgb' for opaque, 'alpha' for the mask
  bgColor: '#ffffff',  // Background color (when channels is 'rgb' or 'rgba')
});
```

### Fixed Output Size

Resize to an exact size without stretching. `fit` decides what happens with the aspect-ratio difference: `contain` (default) pads, `cover` crops the overflow around the subject, `scale-down` pads without ever enlarging a smaller image. Setting only `width` or `height` keeps the aspect ratio. `size` is ignored when a fixed size is set.

```typescript
// 500x500 product image: subject cropped, padded and centred
const result = await poof.removeBackground(file, { crop: true, width: 500, height: 500 });

// Fill a 1080x1080 canvas on white instead
const result = await poof.removeBackground(file, {
  width: 1080,
  height: 1080,
  fit: 'cover',
  format: 'jpg',
  bgColor: '#ffffff',
});

// Cap the width at 1000px, keep the aspect ratio, leave smaller images alone
const result = await poof.removeBackground(file, { width: 1000, fit: 'scale-down' });
```

### Node.js: From File Path

```typescript
import { Poof } from '@poof-bg/js';
import fs from 'node:fs';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

// From file path (Node.js only)
const result = await poof.removeBackground('./input.jpg');

// Save to file
fs.writeFileSync('output.png', Buffer.from(result.data));
```

### Node.js: From Buffer

```typescript
import { Poof } from '@poof-bg/js';
import fs from 'node:fs';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

const imageBuffer = fs.readFileSync('./input.jpg');
const result = await poof.removeBackground(imageBuffer);

fs.writeFileSync('output.png', Buffer.from(result.data));
```

### Video

Videos go through the same `removeBackground()` call. Because a clip takes a while to process, the call returns a `Job` instead of bytes: wait for it with `waitForJob()` (or pass `wait: true`), then download `resultUrl`. Output is a transparent VP9 WebM by default; `format` can also be `mov` (ProRes 4444 with alpha) or `mp4` (H.264, composited on `bgColor`, default white). Audio is kept. Each started second of video costs 5 credits (10 above 30 fps), charged when the job is accepted and refunded if it fails.

```typescript
import { Poof } from '@poof-bg/js';
import fs from 'node:fs';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

// Submit the video: file path (Node.js), File, Blob, Buffer, or { url }
const job = await poof.removeBackground('./clip.mp4', { format: 'webm' });
console.log(`Job ${job.id}: ${job.durationSeconds}s, ${job.credits} credits`);

// Wait for it to finish (polls every 3 s by default; polling is free)
const done = await poof.waitForJob(job, {
  onProgress: (j) => console.log(`${j.status} ${Math.round(j.progress * 100)}%`),
});

// Download the result (no API key needed; the link is valid for 24 hours)
const response = await fetch(done.resultUrl!);
fs.writeFileSync('clip-nobg.webm', Buffer.from(await response.arrayBuffer()));
```

Shorter: `wait: true` submits and waits in one call.

```typescript
const done = await poof.removeBackground('./clip.mp4', {
  format: 'mp4',        // 'webm' (transparent) | 'mov' (transparent ProRes) | 'mp4' (opaque)
  channels: 'rgba',     // 'rgba' | 'rgb' | 'alpha' (grayscale matte video, no audio)
  bgColor: '#00ff00',   // Background for opaque output (mp4 or channels 'rgb'); default white
  size: 'hd',           // Longest side cap: 640 / 1280 / 1920 (hd); 'full' keeps the source up to 4K
  wait: { pollIntervalMs: 5000, timeoutMs: 15 * 60 * 1000 },
});
```

Large videos can be submitted by URL instead of uploading (up to 500 MB; uploads are capped at 100 MB). `{ url }` works for images too.

```typescript
const job = await poof.removeBackground({ url: 'https://example.com/clip.mp4' });
```

Check on a job later with `getJob()`:

```typescript
const job = await poof.getJob('job_8f3a1c2e9b7d4a10');
if (job.status === 'completed') console.log(job.resultUrl);
```

When the input could be either an image or a video, use `isJob()` to tell the results apart:

```typescript
import { Poof, isJob } from '@poof-bg/js';

const result = await poof.removeBackground(upload);
if (isJob(result)) {
  const done = await poof.waitForJob(result);
  console.log('Video ready:', done.resultUrl);
} else {
  fs.writeFileSync('output.png', Buffer.from(result.data));
}
```

A failed job makes `waitForJob()` throw a `PoofError` with code `job_failed`; the credits are refunded automatically. Jobs are limited to 5 minutes of video.

### Account Information

```typescript
const account = await poof.me();

console.log(`Organization: ${account.organizationId}`);
console.log(`Plan: ${account.plan}`);
console.log(`Credits: ${account.usedCredits} / ${account.maxCredits}`);
```

### Processing Metadata

```typescript
const result = await poof.removeBackground(file);

console.log(`Request ID: ${result.metadata.requestId}`);
console.log(`Processing time: ${result.metadata.processingTimeMs}ms`);
console.log(`Output size: ${result.metadata.width}x${result.metadata.height}`);
console.log(`Content type: ${result.metadata.contentType}`);
```

## Error Handling

The SDK provides typed error classes for different error scenarios:

```typescript
import {
  Poof,
  PoofError,
  AuthenticationError,
  PaymentRequiredError,
  RateLimitError,
  ValidationError,
} from '@poof-bg/js';

try {
  const result = await poof.removeBackground(file);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof PaymentRequiredError) {
    console.error('Insufficient credits');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded, retry later');
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.details);
  } else if (error instanceof PoofError && error.code === 'job_failed') {
    console.error('Video job failed, credits refunded:', error.message);
  } else if (error instanceof PoofError) {
    console.error(`API error: ${error.message} (${error.code})`);
    console.error(`Request ID: ${error.requestId}`);
  } else {
    throw error;
  }
}
```

## Configuration

```typescript
const poof = new Poof({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.poof.bg/v1',  // Optional: custom base URL
  timeout: 60000,                      // Optional: request timeout in ms
});
```

## Supported Input Types

| Input Type | Browser | Node.js |
|------------|---------|---------|
| `File`     | ✅      | ✅      |
| `Blob`     | ✅      | ✅      |
| `ArrayBuffer` | ✅   | ✅      |
| `Uint8Array` | ✅    | ✅      |
| `Buffer`   | ❌      | ✅      |
| File path (string) | ❌ | ✅   |
| `{ url: string }` (public https URL) | ✅ | ✅ |

Images: PNG, JPEG, WebP, GIF (first frame), up to 20 MB. Videos: MP4, MOV, WebM, MKV, up to 100 MB uploaded or 500 MB by URL, up to 5 minutes.

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  PoofOptions,
  MediaInput,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  ProcessingMetadata,
  Job,
  JobStatus,
  WaitForJobOptions,
  AccountInfo,
  ImageFormat,
  VideoFormat,
  ImageSize,
  Channels,
} from '@poof-bg/js';
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- Modern browsers with `fetch` and `FormData` support

## License

MIT
