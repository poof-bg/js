import type {
  PoofOptions,
  MediaInput,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  Job,
  JobStatus,
  WaitForJobOptions,
  AccountInfo,
  ApiErrorResponse,
} from './types.js';
import { PoofError } from './errors.js';
import { toBlob, getFilename, isUrlInput, sleep } from './utils.js';

const DEFAULT_BASE_URL = 'https://api.poof.bg/v1';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_JOB_TIMEOUT_MS = 600000;

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
   * Remove the background from an image or a video.
   *
   * Images are processed synchronously and come back as bytes. Videos are
   * processed as a job: the call returns a queued {@link Job}; poll it with
   * {@link getJob} / {@link waitForJob}, or pass `wait: true` to get the
   * completed job (with `resultUrl`) directly. Use {@link isJob} to tell the
   * two apart.
   *
   * @param input - File, Blob, Buffer, ArrayBuffer, Uint8Array, file path (Node.js), or `{ url }`
   * @param options - Processing options
   * @returns Processed image data and metadata, or a video Job
   *
   * @example
   * ```typescript
   * // Image
   * const result = await poof.removeBackground(file);
   * const imageBlob = new Blob([result.data], { type: result.metadata.contentType });
   *
   * // With options
   * const result = await poof.removeBackground(file, { format: 'webp', crop: true, size: 'medium' });
   *
   * // Exact 500x500 output, subject cropped and centred, never stretched
   * const result = await poof.removeBackground(file, { crop: true, width: 500, height: 500 });
   *
   * // Video: submit, then wait for the result
   * const job = await poof.removeBackground('./clip.mp4', { format: 'webm' });
   * const done = await poof.waitForJob(job);
   * console.log(done.resultUrl);
   *
   * // Video from a public URL, waiting inline
   * const done = await poof.removeBackground({ url: 'https://example.com/clip.mp4' }, { wait: true });
   * ```
   */
  async removeBackground(
    input: MediaInput,
    options: RemoveBackgroundOptions = {}
  ): Promise<RemoveBackgroundResult | Job> {
    const formData = new FormData();

    if (isUrlInput(input)) {
      formData.append('url', input.url);
    } else {
      const blob = await toBlob(input);
      const filename = getFilename(input, blob.type);
      formData.append('file', blob, filename);
    }

    // Add optional parameters
    if (options.format) formData.append('format', options.format);
    if (options.channels) formData.append('channels', options.channels);
    if (options.bgColor) formData.append('bg_color', options.bgColor);
    if (options.size) formData.append('size', options.size);
    if (options.crop !== undefined) formData.append('crop', String(options.crop));
    if (options.padding) formData.append('padding', options.padding);
    if (options.width !== undefined) formData.append('width', String(options.width));
    if (options.height !== undefined) formData.append('height', String(options.height));
    if (options.fit) formData.append('fit', options.fit);

    const response = await this.fetch(`${this.baseUrl}/remove`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    // Videos are accepted as a job
    if (response.status === 202) {
      const job = toJob(await response.json());
      if (options.wait) {
        return this.waitForJob(job, options.wait === true ? {} : options.wait);
      }
      return job;
    }

    const data = await response.arrayBuffer();

    const matteConfidence = response.headers.get('X-Matte-Confidence');
    const matteAmbiguousRatio = response.headers.get('X-Matte-Ambiguous-Ratio');

    return {
      data,
      metadata: {
        requestId: response.headers.get('X-Request-ID') || '',
        processingTimeMs: parseInt(response.headers.get('X-Processing-Time-Ms') || '0', 10),
        width: parseInt(response.headers.get('X-Image-Width') || '0', 10),
        height: parseInt(response.headers.get('X-Image-Height') || '0', 10),
        contentType: response.headers.get('Content-Type') || 'image/png',
        matteConfidence: matteConfidence !== null ? parseFloat(matteConfidence) : undefined,
        matteAmbiguousRatio: matteAmbiguousRatio !== null ? parseFloat(matteAmbiguousRatio) : undefined,
      },
    };
  }

  /**
   * Get the current state of a video job. Polling is free and does not count
   * against your rate limit.
   *
   * @param jobId - The job ID returned by removeBackground()
   *
   * @example
   * ```typescript
   * const job = await poof.getJob('job_8f3a1c2e9b7d4a10');
   * console.log(job.status, job.progress);
   * ```
   */
  async getJob(jobId: string): Promise<Job> {
    const response = await this.fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return toJob(await response.json());
  }

  /**
   * Poll a video job until it is completed.
   *
   * @param job - A Job or a job ID
   * @param options - Poll interval, timeout and progress callback
   * @returns The completed job; `resultUrl` is a direct download link valid for 24 hours
   * @throws PoofError with code `job_failed` if the job fails (credits are refunded),
   *   or code `timeout` if `timeoutMs` elapses first
   *
   * @example
   * ```typescript
   * const done = await poof.waitForJob(job, {
   *   onProgress: (j) => console.log(`${Math.round(j.progress * 100)}%`),
   * });
   * const video = await fetch(done.resultUrl!);
   * ```
   */
  async waitForJob(job: Job | string, options: WaitForJobOptions = {}): Promise<Job> {
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    let current: Job = typeof job === 'string' ? await this.getJob(job) : job;
    options.onProgress?.(current);

    while (!isTerminal(current.status)) {
      if (Date.now() >= deadline) {
        throw new PoofError(
          `Timed out after ${timeoutMs}ms waiting for job ${current.id}`,
          'timeout',
          { status: 408 }
        );
      }
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
      current = await this.getJob(current.id);
      options.onProgress?.(current);
    }

    if (current.status === 'failed') {
      throw new PoofError(
        current.error?.message || `Job ${current.id} failed`,
        'job_failed',
        { details: current.error?.code }
      );
    }

    return current;
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

/**
 * Type guard: did removeBackground() return a video Job rather than image bytes?
 *
 * @example
 * ```typescript
 * const result = await poof.removeBackground(input);
 * if (isJob(result)) {
 *   const done = await poof.waitForJob(result);
 * } else {
 *   fs.writeFileSync('output.png', Buffer.from(result.data));
 * }
 * ```
 */
export function isJob(value: RemoveBackgroundResult | Job): value is Job {
  return typeof value === 'object' && value !== null && 'status' in value && typeof (value as Job).id === 'string';
}

function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

/** The job object as the API returns it (snake_case) */
interface RawJob {
  id: string;
  status: JobStatus;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  frames: number;
  credits: number;
  format: Job['format'];
  channels: Job['channels'];
  status_url: string;
  result_url: string | null;
  expires_at: string | null;
  error: Job['error'];
  stats: Job['stats'];
}

function toJob(raw: RawJob): Job {
  return {
    id: raw.id,
    status: raw.status,
    progress: raw.progress ?? 0,
    createdAt: raw.created_at,
    startedAt: raw.started_at ?? null,
    completedAt: raw.completed_at ?? null,
    durationSeconds: raw.duration_seconds,
    fps: raw.fps,
    width: raw.width,
    height: raw.height,
    frames: raw.frames,
    credits: raw.credits,
    format: raw.format,
    channels: raw.channels,
    statusUrl: raw.status_url,
    resultUrl: raw.result_url ?? null,
    expiresAt: raw.expires_at ?? null,
    error: raw.error ?? null,
    stats: raw.stats ?? null,
  };
}
