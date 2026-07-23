import { imageSize } from 'image-size';

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
export const MIN_IMAGE_LONG_EDGE = 2000;

export type SupportedImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export type ImageValidationResult =
  | {
      valid: true;
      contentType: SupportedImageContentType;
      width: number;
      height: number;
      sizeBytes: number;
    }
  | {
      valid: false;
      error: string;
    };

const DECLARED_CONTENT_TYPES = new Map<string, SupportedImageContentType>([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/heic', 'image/heic'],
  ['image/heic-sequence', 'image/heic'],
  ['image/heif', 'image/heif'],
  ['image/heif-sequence', 'image/heif'],
]);

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx']);
const HEIF_BRANDS = new Set(['heif', 'mif1', 'msf1']);

export function validateImage(
  buffer: Buffer,
  declaredContentType: string,
  options: { minLongEdge?: number } = {},
): ImageValidationResult {
  const minLongEdge = options.minLongEdge ?? MIN_IMAGE_LONG_EDGE;
  if (buffer.length === 0) {
    return { valid: false, error: 'Image is empty.' };
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'Image exceeds the 25 MB limit.' };
  }

  const declared = DECLARED_CONTENT_TYPES.get(
    declaredContentType.split(';', 1)[0].trim().toLowerCase(),
  );
  if (!declared) {
    return {
      valid: false,
      error: 'Unsupported declared content type. Accepted types: JPEG, PNG, WebP, HEIC, and HEIF.',
    };
  }

  const detected = detectContentType(buffer);
  if (!detected) {
    return { valid: false, error: 'File contents do not match a supported image format.' };
  }
  if (!contentTypesMatch(declared, detected)) {
    return {
      valid: false,
      error: 'Declared content type does not match the detected image format.',
    };
  }

  try {
    const dimensions = imageSize(buffer);
    const { width, height } = dimensions;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return { valid: false, error: 'Unable to determine image dimensions.' };
    }
    if (minLongEdge > 0 && Math.max(width, height) < minLongEdge) {
      return {
        valid: false,
        error: `Image long edge must be at least ${minLongEdge} pixels.`,
      };
    }

    return {
      valid: true,
      contentType: detected,
      width,
      height,
      sizeBytes: buffer.length,
    };
  } catch {
    return { valid: false, error: 'Unable to determine image dimensions.' };
  }
}

function detectContentType(buffer: Buffer): SupportedImageContentType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const boxSize = buffer.readUInt32BE(0);
    const brandsEnd = Math.min(buffer.length, Math.max(12, boxSize));
    for (let offset = 8; offset + 4 <= brandsEnd; offset += 4) {
      const brand = buffer.toString('ascii', offset, offset + 4);
      if (HEIC_BRANDS.has(brand)) {
        return 'image/heic';
      }
      if (HEIF_BRANDS.has(brand)) {
        return 'image/heif';
      }
    }
  }
  return null;
}

function contentTypesMatch(
  declared: SupportedImageContentType,
  detected: SupportedImageContentType,
): boolean {
  if (declared === detected) {
    return true;
  }
  return (
    (declared === 'image/heic' || declared === 'image/heif') &&
    (detected === 'image/heic' || detected === 'image/heif')
  );
}
