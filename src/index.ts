/**
 * Poof SDK - Background removal for images and video made simple
 *
 * @packageDocumentation
 */

export { Poof, isJob } from './client.js';

export type {
  PoofOptions,
  ImageInput,
  UrlInput,
  MediaInput,
  ImageFormat,
  VideoFormat,
  Channels,
  ImageSize,
  FitMode,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  ProcessingMetadata,
  Job,
  JobStatus,
  JobError,
  WaitForJobOptions,
  AccountInfo,
  ErrorCode,
  ApiErrorResponse,
} from './types.js';

export {
  PoofError,
  AuthenticationError,
  PermissionError,
  PaymentRequiredError,
  RateLimitError,
  ValidationError,
  ServerError,
} from './errors.js';
