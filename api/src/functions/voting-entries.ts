import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listApprovedAnonymized } from '../shared/votes';

export async function votingEntries(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const competitionId = request.params.id;
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required' } };
  }

  try {
    const entries = await listApprovedAnonymized(competitionId);
    context.log({ operation: 'votingEntries.list', competitionId });
    return { status: 200, jsonBody: entries };
  } catch (error) {
    context.log({
      operation: 'votingEntries.list.failed',
      competitionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { status: 500, jsonBody: { error: 'Unable to load voting entries' } };
  }
}

app.http('voting-entries', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/entries',
  handler: votingEntries,
});
