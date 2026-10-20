/**
 * Poof SDK Types
 */

/** Configuration options for the Poof client */
export interface PoofOptions {
  /** Your Poof API key */
  apiKey: string;
  /** Base URL for the API (default: https://api.poof.bg/v1) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
}

/** Output image format */
export type ImageFormat = 'png' | 'jpg' | 'webp';

/**
 * Output video format: VP9 WebM (alpha or opaque), ProRes MOV (alpha or opaque),
 * H.264 MP4 (opaque) or looping animated GIF (1-bit transparency, no audio,
 * capped at 1280 px on the longest side / 720p for widescreen, and 50 fps)
 */
export type VideoFormat = 'webm' | 'mov' | 'mp4' | 'gif';

/** Output color channels */
export type Channels = 'rgba' | 'rgb' | 'alpha';

/**
 * Output size preset. Images: megapixel cap. Videos: longest side capped at
 * 640 (preview), 1280 (medium) or 1920 (hd); 'full' keeps the source
 * resolution up to 4096 px (4K).
 */
export type ImageSize = 'full' | 'preview' | 'medium' | 'hd';

/**
 * How the image is fitted into a fixed width/height (never stretched):
 * 'contain' scales to fit inside and pads the rest, 'cover' scales to fill and
 * crops the overflow around the subject, 'scale-down' is contain without ever
 * enlarging a smaller image.
 */
export type FitMode = 'contain' | 'cover' | 'scale-down';

/** Options for waiting on a video job */
export interface WaitForJobOptions {
  /** Delay between status polls in milliseconds (default: 3000) */
  pollIntervalMs?: number;
  /** Give up after this many milliseconds (default: 600000, i.e. 10 minutes) */
  timeoutMs?: number;
  /** Called after every poll with the latest job state */
  onProgress?: (job: Job) => void;
}

/** Options for background removal */
export interface RemoveBackgroundOptions {
  /** Output format: png, jpg or webp for images (default: png); webm, mov, mp4 or gif for videos (default: webm) */
  format?: ImageFormat | VideoFormat;
  /** Color channels - rgba for transparency, rgb for opaque, alpha for the grayscale mask only (default: rgba) */
  channels?: Channels;
  /**
   * Background color (hex, rgb, or color name; default white). Used for opaque
   * output: channels 'rgb', format 'jpg' and format 'mp4'. Ignored for
   * transparent output
   */
  bgColor?: string;
  /** Output size preset (default: full) */
  size?: ImageSize;
  /** Images only. Crop to subject bounds: true or an aspect ratio like '1:1', '4:3', '16:9' (default: false; not sent unless enabled) */
  crop?: boolean | string;
  /** Padding around the subject when crop is enabled, as a fraction ('0.1') or percentage ('10%') */
  padding?: string;
  /** Output width in pixels (1-6000). On its own, the height follows the aspect ratio. Overrides size */
  width?: number;
  /** Output height in pixels (1-6000). On its own, the width follows the aspect ratio. Overrides size */
  height?: number;
  /** How to fit into width x height without stretching (default: contain) */
  fit?: FitMode;
  /**
   * Videos only: wait for the job to finish and return the completed Job
   * instead of the queued one. Pass an object to tune polling.
   */
  wait?: boolean | WaitForJobOptions;
}

/** Metadata returned with processed images */
export interface ProcessingMetadata {
  /** Unique request identifier */
  requestId: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Output image width in pixels */
  width: number;
  /** Output image height in pixels */
  height: number;
  /** Content type of the result */
  contentType: string;
  /**
   * Confidence in the alpha matte, 0-1. 1 means a fully decisive mask; lower
   * values mean the model hedged. Heuristic, not a calibrated probability.
   */
  matteConfidence?: number;
  /**
   * Fraction of pixels with alpha between 0.1 and 0.9, 0-1. High values
   * indicate large uncertain regions - useful for flagging results for review.
   */
  matteAmbiguousRatio?: number;
}

/** Result of background removal including image data and metadata */
export interface RemoveBackgroundResult {
  /** The processed image data */
  data: ArrayBuffer;
  /** Processing metadata */
  metadata: ProcessingMetadata;
}

/** State of a video job */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** Why a video job failed */
export interface JobError {
  /** Machine-readable error code, e.g. processing_failed */
  code: string;
  /** Human-readable description */
  message: string;
}

/**
 * A video background removal job. Returned with status 'queued' when a video
 * is submitted; poll with getJob() or waitForJob() until it is 'completed'.
 */
export interface Job {
  /** Job ID, prefixed with job_ */
  id: string;
  /** queued and processing are transient; completed and failed are terminal */
  status: JobStatus;
  /** Fraction of the video processed so far, 0 to 1 */
  progress: number;
  /** When the job was accepted (ISO 8601) */
  createdAt: string;
  /** When processing began; null while queued */
  startedAt: string | null;
  /** When the job reached completed or failed; null until then */
  completedAt: string | null;
  /** Source video duration in seconds */
  durationSeconds: number;
  /** Source frame rate */
  fps: number;
  /** Source video width in pixels */
  width: number;
  /** Source video height in pixels */
  height: number;
  /** Number of frames in the source video */
  frames: number;
  /**
   * Credits charged for this job: 5 per started second of video (10 above
   * 30 fps; animated GIF input is always 5 per second). Refunded if it fails
   */
  credits: number;
  /** Requested output format */
  format: VideoFormat;
  /** Requested output channels */
  channels: Channels;
  /** URL of the job; GET it to poll for progress */
  statusUrl: string;
  /** Direct download URL of the result on the Poof CDN once completed, null before that. No API key needed */
  resultUrl: string | null;
  /** When the result is deleted, 24 hours after completion; null until completed */
  expiresAt: string | null;
  /** Set when status is failed, null otherwise */
  error: JobError | null;
  /** Processing statistics once completed (output_width, output_height, processing_seconds, ...), null before */
  stats: Record<string, unknown> | null;
}

/** Account information */
export interface AccountInfo {
  /** Your organization ID */
  organizationId: string;
  /** Current plan name */
  plan: string;
  /** Total credits available in billing cycle */
  maxCredits: number;
  /** Credits used in current billing cycle */
  usedCredits: number;
  /** Credit threshold for auto-recharge (if enabled) */
  autoRechargeThreshold: number | null;
}

/** Error codes returned by the API */
export type ErrorCode =
  | 'authentication_error'
  | 'permission_denied'
  | 'payment_required'
  | 'rate_limit_exceeded'
  | 'validation_error'
  | 'missing_image'
  | 'image_too_large'
  | 'invalid_image'
  | 'processing_failed'
  | 'not_found'
  | 'video_too_large'
  | 'video_too_long'
  | 'invalid_video'
  | 'job_not_found'
  | 'job_failed'
  | 'upstream_error'
  | 'internal_server_error';

/** API error response structure */
export interface ApiErrorResponse {
  code: ErrorCode;
  message: string;
  /** Extra context; for validation_error an object such as { field: 'crop' } */
  details?: ErrorDetails;
  request_id: string;
  /** Link to the documentation page for this error code */
  doc_url?: string;
}

/** Optional extra context on an API error: an object for validation errors, or a string */
export type ErrorDetails = Record<string, unknown> | string;

/** Valid input types for image and video processing: file contents, or a file path in Node.js */
export type ImageInput = File | Blob | ArrayBuffer | Buffer | Uint8Array | string;

/** A publicly reachable https URL that Poof downloads instead of an upload (images up to 20 MB, videos up to 500 MB) */
export interface UrlInput {
  url: string;
}

/** Anything removeBackground() accepts: file contents, a file path (Node.js) or `{ url }` */
export type MediaInput = ImageInput | UrlInput;
