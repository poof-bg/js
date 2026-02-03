import type {
  PoofOptions,
  ImageInput,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  AccountInfo,
  ApiErrorResponse,
} from './types.js';
import { PoofError } from './errors.js';
import { toBlob, getFilename } from './utils.js';

const DEFAULT_BASE_URL = 'https://api.poof.bg/v1';
const DEFAULT_TIMEOUT = 60000;

/**
 * Poof API client for background removal
 *
 * @example
 * ```typescript
 * import { Poof } from '@poof-bg/js';
 *
 * const poof = new Poof({ apiKey: 'your-api-key' });
 * const result = await poof.removeBackground(imageFile);
 * ```
 */
export class Poof {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: PoofOptions) {
    if (!options.apiKey) {
      throw new Error('API key is required');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Remove background from an image
   *
   * @param input - Image input: File, Blob, Buffer, ArrayBuffer, Uint8Array, or file path (Node.js)
   * @param options - Processing options
   * @returns Processed image data and metadata
   *
   * @example
   * ```typescript
   * // Basic usage
   * const result = await poof.removeBackground(file);
   * const imageBlob = new Blob([result.data], { type: result.metadata.contentType });
   *
   * // With options
   * const result = await poof.removeBackground(file, {
   *   format: 'webp',
   *   crop: true,
   *   size: 'medium'
   * });
   *
   * // Node.js: from file path
   * const result = await poof.removeBackground('/path/to/image.png');
   *
   * // Node.js: save to file
   * const fs = require('fs');
   * fs.writeFileSync('output.png', Buffer.from(result.data));
   * ```
   */
  async removeBackground(
    input: ImageInput,
    options: RemoveBackgroundOptions = {}
  ): Promise<RemoveBackgroundResult> {
    const blob = await toBlob(input);
    const filename = getFilename(input, blob.type);

    const formData = new FormData();
    formData.append('image_file', blob, filename);

    // Add optional parameters
    if (options.format) formData.append('format', options.format);
    if (options.channels) formData.append('channels', options.channels);
    if (options.bgColor) formData.append('bg_color', options.bgColor);
    if (options.size) formData.append('size', options.size);
    if (options.crop !== undefined) formData.append('crop', String(options.crop));

    const response = await this.fetch(`${this.baseUrl}/remove`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const data = await response.arrayBuffer();

    return {
      data,
      metadata: {
        requestId: response.headers.get('X-Request-ID') || '',
        processingTimeMs: parseInt(response.headers.get('X-Processing-Time-Ms') || '0', 10),
        width: parseInt(response.headers.get('X-Image-Width') || '0', 10),
        height: parseInt(response.headers.get('X-Image-Height') || '0', 10),
        contentType: response.headers.get('Content-Type') || 'image/png',
      },
    };
  }

  /**
   * Get account information
   *
   * @returns Account info including plan and credit usage
   *
   * @example
   * ```typescript
   * const account = await poof.me();
   * console.log(`Plan: ${account.plan}`);
   * console.log(`Credits: ${account.usedCredits}/${account.maxCredits}`);
   * ```
   */
  async me(): Promise<AccountInfo> {
    const response = await this.fetch(`${this.baseUrl}/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  /** Make a fetch request with auth and timeout */
  private async fetch(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('x-api-key', this.apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PoofError('Request timeout', 'timeout', { status: 408 });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Handle error response */
  private async handleError(response: Response): Promise<never> {
    let errorData: ApiErrorResponse;

    try {
      errorData = await response.json();
    } catch {
      throw new PoofError(
        `HTTP ${response.status}: ${response.statusText}`,
        'unknown_error',
        { status: response.status }
      );
    }

    throw PoofError.fromResponse(errorData, response.status);
  }
}
