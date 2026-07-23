export interface ModerationResult {
  flagged: boolean;
  severities: Record<string, string>;
}

export type ModerationLogger = (details: Record<string, unknown>) => void;

interface CategoriesAnalysisItem {
  category?: unknown;
  severity?: unknown;
}

interface AnalyzeImageResponse {
  categoriesAnalysis?: unknown;
}

const MODERATION_TIMEOUT_MS = 10_000;

export async function analyzeImage(
  imageBuffer: Buffer,
  log?: ModerationLogger,
): Promise<ModerationResult> {
  const endpoint = process.env.CONTENT_SAFETY_ENDPOINT?.trim();
  const key = process.env.CONTENT_SAFETY_KEY?.trim();
  if (!endpoint || !key) {
    log?.({
      operation: 'moderation.analyze',
      outcome: 'not_configured',
    });
    return {
      flagged: true,
      severities: { error: 'moderation_not_configured' },
    };
  }

  try {
    const response = await fetch(
      `${endpoint.replace(/\/+$/, '')}/contentsafety/image:analyze?api-version=2024-09-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': key,
        },
        body: JSON.stringify({ image: { content: imageBuffer.toString('base64') } }),
        signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new ModerationServiceError(response.status);
    }

    const payload = (await response.json()) as AnalyzeImageResponse;
    const analyses = Array.isArray(payload.categoriesAnalysis)
      ? (payload.categoriesAnalysis as CategoriesAnalysisItem[])
      : [];
    const severities: Record<string, string> = {};
    let flagged = false;

    for (const analysis of analyses) {
      if (typeof analysis.category !== 'string' || typeof analysis.severity !== 'number') {
        continue;
      }
      severities[analysis.category] = String(analysis.severity);
      flagged ||= analysis.severity >= 2;
    }

    return { flagged, severities };
  } catch (error: unknown) {
    log?.({
      operation: 'moderation.analyze',
      outcome: 'unavailable',
      errorType: error instanceof Error ? error.name : 'unknown',
      ...(error instanceof ModerationServiceError ? { status: error.status } : {}),
    });
    return {
      flagged: true,
      severities: { error: 'moderation_unavailable' },
    };
  }
}

class ModerationServiceError extends Error {
  constructor(readonly status: number) {
    super(`Content Safety returned status ${status}`);
  }
}
