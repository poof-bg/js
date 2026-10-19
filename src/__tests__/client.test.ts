import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Poof, isJob } from '../index.js';
import { PoofError, ValidationError } from '../errors.js';
import type { Job } from '../types.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
// 'ftyp' at offset 4 with the isom brand
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);

const rawJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job_8f3a1c2e9b7d4a10',
  status: 'queued',
  progress: 0,
  created_at: '2026-10-16T10:00:00Z',
  started_at: null,
  completed_at: null,
  duration_seconds: 12.4,
  fps: 29.97,
  width: 1920,
  height: 1080,
  frames: 372,
  credits: 65,
  format: 'webm',
  channels: 'rgba',
  status_url: 'https://api.poof.bg/v1/jobs/job_8f3a1c2e9b7d4a10',
  result_url: null,
  expires_at: null,
  error: null,
  stats: null,
  ...overrides,
});

type Call = { url: string; init: RequestInit };
let calls: Call[];
let responses: Response[];

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  calls = [];
  responses = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      if (!next) throw new Error(`No mocked response for ${String(url)}`);
      return next;
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function formOf(call: Call): Promise<FormData> {
  return new Request('https://x', { method: 'POST', body: call.init.body as FormData }).formData();
}

const poof = () => new Poof({ apiKey: 'pk_test' });

describe('removeBackground (image)', () => {
  it('uploads as `file`, forwards options and returns bytes + metadata', async () => {
    responses.push(
      new Response(PNG, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'X-Request-ID': 'req_1',
          'X-Processing-Time-Ms': '123',
          'X-Image-Width': '640',
          'X-Image-Height': '480',
          'X-Matte-Confidence': '0.97',
        },
      })
    );

    const result = await poof().removeBackground(PNG, { format: 'webp', crop: true, width: 500 });

    expect(isJob(result)).toBe(false);
    if (isJob(result)) throw new Error('unreachable');
    expect(new Uint8Array(result.data)).toEqual(PNG);
    expect(result.metadata).toMatchObject({
      requestId: 'req_1',
      processingTimeMs: 123,
      width: 640,
      height: 480,
      contentType: 'image/png',
      matteConfidence: 0.97,
      matteAmbiguousRatio: undefined,
    });

    expect(calls[0].url).toBe('https://api.poof.bg/v1/remove');
    expect(new Headers(calls[0].init.headers).get('x-api-key')).toBe('pk_test');
    const form = await formOf(calls[0]);
    const file = form.get('file') as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('image.png');
    expect(form.get('image_file')).toBeNull();
    expect(form.get('format')).toBe('webp');
    expect(form.get('crop')).toBe('true');
    expect(form.get('width')).toBe('500');
  });

  it('sends `url` for { url } input', async () => {
    responses.push(new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } }));

    await poof().removeBackground({ url: 'https://example.com/photo.jpg' });

    const form = await formOf(calls[0]);
    expect(form.get('url')).toBe('https://example.com/photo.jpg');
    expect(form.get('file')).toBeNull();
  });

  it('maps API errors to typed errors', async () => {
    responses.push(
      json(400, { code: 'invalid_video', message: 'Could not decode the video', request_id: 'req_2' })
    );

    const error = await poof().removeBackground(MP4).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe('invalid_video');
    expect(error.status).toBe(400);
    expect(error.requestId).toBe('req_2');
  });
});

describe('removeBackground (video)', () => {
  it('returns a Job with camelCase fields on 202 and sniffs the video type', async () => {
    responses.push(json(202, rawJob()));

    const result = await poof().removeBackground(MP4, { format: 'webm', channels: 'rgba' });

    expect(isJob(result)).toBe(true);
    const job = result as Job;
    expect(job).toEqual({
      id: 'job_8f3a1c2e9b7d4a10',
      status: 'queued',
      progress: 0,
      createdAt: '2026-10-16T10:00:00Z',
      startedAt: null,
      completedAt: null,
      durationSeconds: 12.4,
      fps: 29.97,
      width: 1920,
      height: 1080,
      frames: 372,
      credits: 65,
      format: 'webm',
      channels: 'rgba',
      statusUrl: 'https://api.poof.bg/v1/jobs/job_8f3a1c2e9b7d4a10',
      resultUrl: null,
      expiresAt: null,
      error: null,
      stats: null,
    });

    const form = await formOf(calls[0]);
    const file = form.get('file') as File;
    expect(file.type).toBe('video/mp4');
    expect(file.name).toBe('video.mp4');
    expect(form.get('format')).toBe('webm');
  });

  it('detects WebM input', async () => {
    responses.push(json(202, rawJob({ format: 'mov' })));
    await poof().removeBackground(WEBM, { format: 'mov' });
    const file = (await formOf(calls[0])).get('file') as File;
    expect(file.type).toBe('video/webm');
    expect(file.name).toBe('video.webm');
  });

  it('sends `url` for { url } input and waits inline with wait: true', async () => {
    responses.push(
      json(202, rawJob()),
      json(200, rawJob({ status: 'processing', progress: 0.5, started_at: '2026-10-16T10:00:01Z' })),
      json(
        200,
        rawJob({
          status: 'completed',
          progress: 1,
          result_url: 'https://cdn.poof.bg/1d/jobs/job_8f3a1c2e9b7d4a10/result.webm',
          expires_at: '2026-10-17T10:00:10Z',
          stats: { output_width: 1920, output_height: 1080, processing_seconds: 9.1 },
        })
      )
    );

    const progress: number[] = [];
    const result = await poof().removeBackground(
      { url: 'https://example.com/clip.mp4' },
      { wait: { pollIntervalMs: 0, onProgress: (j) => progress.push(j.progress) } }
    );

    expect((await formOf(calls[0])).get('url')).toBe('https://example.com/clip.mp4');
    expect(calls.slice(1).map((c) => c.url)).toEqual([
      'https://api.poof.bg/v1/jobs/job_8f3a1c2e9b7d4a10',
      'https://api.poof.bg/v1/jobs/job_8f3a1c2e9b7d4a10',
    ]);
    expect(calls[1].init.method).toBe('GET');
    expect(progress).toEqual([0, 0.5, 1]);
    const job = result as Job;
    expect(job.status).toBe('completed');
    expect(job.resultUrl).toBe('https://cdn.poof.bg/1d/jobs/job_8f3a1c2e9b7d4a10/result.webm');
    expect(job.stats).toEqual({ output_width: 1920, output_height: 1080, processing_seconds: 9.1 });
  });
});

describe('getJob', () => {
  it('GETs /jobs/{id} and maps the response', async () => {
    responses.push(json(200, rawJob({ status: 'processing', progress: 0.42 })));

    const job = await poof().getJob('job_8f3a1c2e9b7d4a10');

    expect(calls[0].url).toBe('https://api.poof.bg/v1/jobs/job_8f3a1c2e9b7d4a10');
    expect(calls[0].init.method).toBe('GET');
    expect(job.status).toBe('processing');
    expect(job.progress).toBe(0.42);
  });

  it('throws job_not_found for unknown ids', async () => {
    responses.push(json(404, { code: 'job_not_found', message: 'No such job', request_id: 'req_3' }));
    const error = await poof().getJob('job_nope').catch((e) => e);
    expect(error).toBeInstanceOf(PoofError);
    expect(error.code).toBe('job_not_found');
    expect(error.status).toBe(404);
  });
});

describe('waitForJob', () => {
  it('polls until completed and reports progress', async () => {
    responses.push(
      json(200, rawJob({ status: 'processing', progress: 0.3 })),
      json(200, rawJob({ status: 'completed', progress: 1, result_url: 'https://cdn.poof.bg/1d/jobs/x/result.webm' }))
    );
    const seen: string[] = [];

    const done = await poof().waitForJob('job_8f3a1c2e9b7d4a10', {
      pollIntervalMs: 0,
      onProgress: (j) => seen.push(`${j.status}:${j.progress}`),
    });

    expect(done.status).toBe('completed');
    expect(done.resultUrl).toBe('https://cdn.poof.bg/1d/jobs/x/result.webm');
    expect(seen).toEqual(['processing:0.3', 'completed:1']);
    expect(calls).toHaveLength(2);
  });

  it('returns immediately for a job that is already terminal', async () => {
    const job = (await (async () => {
      responses.push(json(200, rawJob({ status: 'completed', progress: 1, result_url: 'https://cdn.poof.bg/r' })));
      return poof().getJob('job_8f3a1c2e9b7d4a10');
    })());
    calls = [];

    const done = await poof().waitForJob(job);
    expect(done).toBe(job);
    expect(calls).toHaveLength(0);
  });

  it('throws job_failed when the job fails', async () => {
    responses.push(
      json(200, rawJob({ status: 'failed', error: { code: 'processing_failed', message: 'The encoder failed' } }))
    );

    const error = await poof().waitForJob('job_8f3a1c2e9b7d4a10', { pollIntervalMs: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(PoofError);
    expect(error.code).toBe('job_failed');
    expect(error.message).toBe('The encoder failed');
    expect(error.details).toBe('processing_failed');
  });

  it('throws timeout when the deadline passes', async () => {
    for (let i = 0; i < 50; i++) {
      responses.push(json(200, rawJob({ status: 'processing', progress: i / 50 })));
    }

    const error = await poof()
      .waitForJob('job_8f3a1c2e9b7d4a10', { pollIntervalMs: 5, timeoutMs: 40 })
      .catch((e) => e);

    expect(error).toBeInstanceOf(PoofError);
    expect(error.code).toBe('timeout');
    expect(error.status).toBe(408);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.length).toBeLessThan(50);
  });
});
