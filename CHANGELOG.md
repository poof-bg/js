# Changelog

All notable changes to `@poof-bg/js`. Versions follow [semver](https://semver.org).

## 1.3.1 - 2026-10-20

### Fixed

- `crop` is only sent when enabled (`true` or an aspect ratio). `crop: false` on a video used to be forwarded and rejected with a 400 `validation_error`.
- `ApiErrorResponse.details` / `PoofError.details` are typed `Record<string, unknown> | string` (the API returns an object such as `{ field: 'crop' }` for validation errors).

### Added

- `PoofError.docUrl` and `ApiErrorResponse.doc_url`: link to the documentation page for the error code.
- `ErrorCode` now includes `processing_failed` and `not_found`; `processing_failed` maps to `ServerError`.
- Exported `ErrorDetails` and `PoofErrorOptions` types.
- GitHub Releases are created automatically when a version tag is pushed.

### Docs

- `gif` output: looping, 1-bit transparency, no audio, capped at 1280 px on the longest side (720p for widescreen) and 50 fps.
- Audio is kept except for `gif` and `channels: 'alpha'` output.
- `bgColor` applies to opaque output (`channels: 'rgb'`, `jpg`, `mp4`) and is ignored for transparent output.
- Video pricing: 5 credits per second rounded up (10 above 30 fps); animated GIF input is always 5 credits per second. A 402 `payment_required` is returned when remaining credits don't cover the clip.
- Limits: 5 minutes, 100 MB upload, 500 MB by URL.

## 1.3.0 - 2026-10-20

- Added `gif` to `VideoFormat`: animated GIF output for stickers and chat. Animated GIF input is processed as a video.
- Documented 4K output for videos with `size: 'full'`.

## 1.2.0 - 2026-10-19

- Video background removal: `removeBackground()` returns a `Job` for videos (HTTP 202), plus `getJob()`, `waitForJob()`, the `wait` option, `isJob()` and `{ url }` input.
- Video output formats `webm`, `mov` and `mp4`.

## 1.1.0 - 2026-09-07

- `channels: 'alpha'` (grayscale mask output) and matte confidence metadata (`matteConfidence`, `matteAmbiguousRatio`).
- `width`, `height` and `fit` output-size options; corrected size presets.
- Publishing to npm on version tags via trusted publishing.

## 1.0.0 - 2026-02-03

- Initial release.
