/**
 * Poof SDK - Background removal made simple
 *
 * @packageDocumentation
 */

export { Poof } from './client.js';

export type {
  PoofOptions,
  ImageInput,
  ImageFormat,
  Channels,
  ImageSize,
  RemoveBackgroundOptions,
  RemoveBackgroundResult,
  ProcessingMetadata,
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
