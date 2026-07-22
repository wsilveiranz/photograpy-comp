import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { EntryServiceError, getEntryImageUrl } from '../shared/entries';

export async function redirectToImage(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const competitionId = request.params.competitionId ?? '';
  const entryId = request.params.entryId ?? '';
  const variant = request.query.get('variant');
  if (variant !== 'thumb' && variant !== 'original') {
    return {
      status: 400,
      jsonBody: { error: 'variant must be thumb or original.' },
    };
  }

  try {
    const location = await getEntryImageUrl(competitionId, entryId, variant);
    context.log({
      operation: 'images.redirect',
      outcome: 'success',
      competitionId,
      entryId,
      variant,
    });
    return {
      status: 302,
      headers: {
        Location: location,
        'Cache-Control': 'private, no-store',
      },
    };
  } catch (error: unknown) {
    const status = error instanceof EntryServiceError ? error.status : 500;
    context.log({
      operation: 'images.redirect',
      outcome: status === 404 ? 'notFound' : 'failed',
      competitionId,
      entryId,
      variant,
      status,
    });
    return {
      status,
      jsonBody: {
        error: error instanceof EntryServiceError ? error.message : 'Unable to load image.',
      },
    };
  }
}

app.http('entryImages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'images/{competitionId}/{entryId}',
  handler: redirectToImage,
});
