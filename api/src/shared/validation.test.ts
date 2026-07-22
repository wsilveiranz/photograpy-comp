import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { deriveAlias } from './aliases';
import { MAX_IMAGE_SIZE_BYTES, validateImage } from './validation';

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe('validateImage', () => {
  it('accepts a valid PNG with a 2000px long edge', () => {
    expect(validateImage(png(2000, 1200), 'image/png')).toMatchObject({
      valid: true,
      contentType: 'image/png',
      width: 2000,
      height: 1200,
    });
  });

  it('accepts a valid JPEG with a 2000px long edge', async () => {
    const buffer = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: 'black' },
    })
      .jpeg()
      .toBuffer();

    expect(validateImage(buffer, 'image/jpeg')).toMatchObject({
      valid: true,
      contentType: 'image/jpeg',
      width: 2000,
      height: 1200,
    });
  });

  it('rejects a mismatched declared image format', () => {
    expect(validateImage(png(2000, 1200), 'image/jpeg')).toEqual({
      valid: false,
      error: 'Declared content type does not match the detected image format.',
    });
    expect(validateImage(Buffer.from('not an image'), 'image/png')).toEqual({
      valid: false,
      error: 'File contents do not match a supported image format.',
    });
  });

  it('rejects oversized and under-resolution images', () => {
    expect(validateImage(Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1), 'image/png')).toMatchObject({
      valid: false,
      error: 'Image exceeds the 25 MB limit.',
    });
    expect(validateImage(png(1999, 1200), 'image/png')).toMatchObject({
      valid: false,
      error: 'Image long edge must be at least 2000 pixels.',
    });
  });
});

describe('deriveAlias', () => {
  it('is stable and never includes the principal email', () => {
    const principal = {
      userId: 'stable-id',
      userDetails: 'person@example.test',
      claims: [],
      roles: [],
    };

    const alias = deriveAlias(principal);

    expect(deriveAlias(principal)).toBe(alias);
    expect(alias).not.toContain(principal.userDetails);
  });
});
