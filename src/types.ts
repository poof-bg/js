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

/** Output color channels */
export type Channels = 'rgba' | 'rgb' | 'alpha';

/** Output image size preset */
export type ImageSize = 'full' | 'preview' | 'medium' | 'hd';

/** Options for background removal */
export interface RemoveBackgroundOptions {
  /** Output format (default: png) */
  format?: ImageFormat;
  /** Color channels - rgba for transparency, rgb for opaque, alpha for the grayscale mask only (default: rgba) */
  channels?: Channels;
  /** Background color (hex, rgb, or color name). Applies when channels is 'rgb' or 'rgba' */
  bgColor?: string;
  /** Output size preset (default: full) */
  size?: ImageSize;
  /** Crop to subject bounds: true/false or an aspect ratio like '1:1', '4:3', '16:9' (default: false) */
  crop?: boolean | string;
  /** Padding around the subject when crop is enabled, as a fraction ('0.1') or percentage ('10%') */
  padding?: string;
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
  | 'upstream_error'
  | 'internal_server_error';

/** API error response structure */
export interface ApiErrorResponse {
  code: ErrorCode;
  message: string;
  details?: string;
  request_id: string;
}

/** Valid input types for image processing */
export type ImageInput = File | Blob | ArrayBuffer | Buffer | Uint8Array | string;
