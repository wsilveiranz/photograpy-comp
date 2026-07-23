import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeImage } from './moderation';

const image = Buffer.from('image-bytes');

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('flags for manual review when the service is not configured', async () => {
    vi.stubEnv('CONTENT_SAFETY_ENDPOINT', '');
    vi.stubEnv('CONTENT_SAFETY_KEY', '');
    const log = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await analyzeImage(image, log);

    expect(result).toEqual({
      flagged: true,
      severities: { error: 'moderation_not_configured' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'moderation.analyze', outcome: 'not_configured' }),
    );
  });

  it('flags for manual review when the configured service is unavailable', async () => {
    vi.stubEnv('CONTENT_SAFETY_ENDPOINT', 'https://safety.example');
    vi.stubEnv('CONTENT_SAFETY_KEY', 'secret');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const result = await analyzeImage(image);

    expect(result).toEqual({
      flagged: true,
      severities: { error: 'moderation_unavailable' },
    });
  });

  it('does not flag a clean image when the service reports low severities', async () => {
    vi.stubEnv('CONTENT_SAFETY_ENDPOINT', 'https://safety.example');
    vi.stubEnv('CONTENT_SAFETY_KEY', 'secret');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          categoriesAnalysis: [
            { category: 'Hate', severity: 0 },
            { category: 'Violence', severity: 1 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await analyzeImage(image);

    expect(result).toEqual({
      flagged: false,
      severities: { Hate: '0', Violence: '1' },
    });
  });
});
