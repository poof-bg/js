import type { ImageInput } from './types.js';

/** Check if running in Node.js environment */
export const isNode = typeof process !== 'undefined' && process.versions?.node;

/** Detect MIME type from buffer */
function detectMimeType(buffer: Uint8Array): string {
  // Check magic bytes
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    // RIFF header, check for WEBP
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  // Default to octet-stream
  return 'application/octet-stream';
}

/** Get file extension from MIME type */
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mimeType] || 'bin';
}

/** Convert various input types to a Blob suitable for FormData */
export async function toBlob(input: ImageInput): Promise<Blob> {
  // Already a Blob or File
  if (input instanceof Blob) {
    return input;
  }

  // ArrayBuffer
  if (input instanceof ArrayBuffer) {
    const uint8 = new Uint8Array(input);
    const mimeType = detectMimeType(uint8);
    return new Blob([input], { type: mimeType });
  }

  // Uint8Array
  if (input instanceof Uint8Array) {
    const mimeType = detectMimeType(input);
    return new Blob([input], { type: mimeType });
  }

  // Node.js Buffer
  if (isNode && Buffer.isBuffer(input)) {
    const uint8 = new Uint8Array(input);
    const mimeType = detectMimeType(uint8);
    return new Blob([input], { type: mimeType });
  }

  // String - treat as file path (Node.js only)
  if (typeof input === 'string') {
    if (!isNode) {
      throw new Error('File paths are only supported in Node.js. Use a Blob or File in the browser.');
    }
    
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    const buffer = await fs.readFile(input);
    const uint8 = new Uint8Array(buffer);
    const mimeType = detectMimeType(uint8);
    const ext = path.extname(input).toLowerCase().slice(1);
    
    // Use file extension for mime type if available
    const mimeFromExt: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    
    const finalMimeType = mimeFromExt[ext] || mimeType;
    return new Blob([buffer], { type: finalMimeType });
  }

  throw new Error(`Unsupported input type: ${typeof input}`);
}

/** Get filename for FormData */
export function getFilename(input: ImageInput, mimeType: string): string {
  // File has a name
  if (typeof File !== 'undefined' && input instanceof File) {
    return input.name;
  }

  // String path
  if (typeof input === 'string' && isNode) {
    // Extract filename from path
    const parts = input.split(/[/\\]/);
    return parts[parts.length - 1] || `image.${getExtension(mimeType)}`;
  }

  // Generate name from mime type
  return `image.${getExtension(mimeType)}`;
}
