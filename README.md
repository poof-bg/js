# @poof/sdk

Official TypeScript/JavaScript SDK for the [Poof](https://poof.bg) background removal API.

## Installation

```bash
npm install @poof/sdk
# or
yarn add @poof/sdk
# or
pnpm add @poof/sdk
```

## Quick Start

```typescript
import { Poof } from '@poof/sdk';

const poof = new Poof({ apiKey: 'your-api-key' });

// Remove background from an image
const result = await poof.removeBackground(imageFile);

// result.data is an ArrayBuffer containing the processed image
// result.metadata contains processing info
```

## Usage

### Basic Background Removal

```typescript
import { Poof } from '@poof/sdk';

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
  crop: true,          // Crop to subject bounds
  size: 'medium',      // Size: 'full' | 'preview' | 'small' | 'medium' | 'large'
  channels: 'rgb',     // 'rgba' for transparency, 'rgb' for opaque
  bgColor: '#ffffff',  // Background color (when channels is 'rgb')
});
```

### Node.js: From File Path

```typescript
import { Poof } from '@poof/sdk';
import fs from 'node:fs';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

// From file path (Node.js only)
const result = await poof.removeBackground('./input.jpg');

// Save to file
fs.writeFileSync('output.png', Buffer.from(result.data));
```

### Node.js: From Buffer

```typescript
import { Poof } from '@poof/sdk';
import fs from 'node:fs';

const poof = new Poof({ apiKey: process.env.POOF_API_KEY! });

const imageBuffer = fs.readFileSync('./input.jpg');
const result = await poof.removeBackground(imageBuffer);

fs.writeFileSync('output.png', Buffer.from(result.data));
```

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
} from '@poof/sdk';

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

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  PoofOptions,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  ProcessingMetadata,
  AccountInfo,
  ImageFormat,
  ImageSize,
  Channels,
} from '@poof/sdk';
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- Modern browsers with `fetch` and `FormData` support

## License

MIT
