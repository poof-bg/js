import type { ErrorCode, ApiErrorResponse, ErrorDetails } from './types.js';

/** Options accepted by every Poof error class */
export interface PoofErrorOptions {
  status?: number;
  requestId?: string;
  details?: ErrorDetails;
  docUrl?: string;
}

/**
 * Base error class for all Poof SDK errors
 */
export class PoofError extends Error {
  /** Machine-readable error code */
  readonly code: string;
  /** HTTP status code */
  readonly status?: number;
  /** Unique request ID for support */
  readonly requestId?: string;
  /** Additional details: an object for validation errors (e.g. { field: 'crop' }), or a string */
  readonly details?: ErrorDetails;
  /** Link to the documentation page for this error code */
  readonly docUrl?: string;

  constructor(
    message: string,
    code: string,
    options?: PoofErrorOptions
  ) {
    super(message);
    this.name = 'PoofError';
    this.code = code;
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.details = options?.details;
    this.docUrl = options?.docUrl;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Create error from API response */
  static fromResponse(response: ApiErrorResponse, status: number): PoofError {
    const ErrorClass = ERROR_MAP[response.code] || PoofError;
    return new ErrorClass(response.message, response.code, {
      status,
      requestId: response.request_id,
      details: response.details,
      docUrl: response.doc_url,
    });
  }
}

/**
 * Thrown when the API key is invalid or missing
 */
export class AuthenticationError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when the account doesn't have permission
 */
export class PermissionError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'PermissionError';
  }
}

/**
 * Thrown when the account has insufficient credits
 */
export class PaymentRequiredError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'PaymentRequiredError';
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'RateLimitError';
  }
}

/**
 * Thrown when request parameters are invalid
 */
export class ValidationError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a server error occurs
 */
export class ServerError extends PoofError {
  constructor(message: string, code: string, options?: PoofErrorOptions) {
    super(message, code, options);
    this.name = 'ServerError';
  }
}

/** Map error codes to error classes */
const ERROR_MAP: Record<ErrorCode, typeof PoofError> = {
  authentication_error: AuthenticationError,
  permission_denied: PermissionError,
  payment_required: PaymentRequiredError,
  rate_limit_exceeded: RateLimitError,
  validation_error: ValidationError,
  missing_image: ValidationError,
  image_too_large: ValidationError,
  invalid_image: ValidationError,
  processing_failed: ServerError,
  not_found: PoofError,
  video_too_large: ValidationError,
  video_too_long: ValidationError,
  invalid_video: ValidationError,
  job_not_found: ValidationError,
  job_failed: PoofError,
  upstream_error: ServerError,
  internal_server_error: ServerError,
};
