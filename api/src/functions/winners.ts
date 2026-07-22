import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getWinners, ResultsError } from '../shared/results';

export async function winners(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const competitionId = request.params.id;
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required.' } };
  }

  try {
    const data = await getWinners(competitionId);
    if (!data) {
      return { status: 404, jsonBody: { error: 'Winners are not available until the competition closes.' } };
    }
    context.log({ operation: 'winners.get', competitionId });
    return { status: 200, jsonBody: data };
  } catch (error) {
    const status = error instanceof ResultsError ? error.status : 500;
    const message = error instanceof ResultsError ? error.message : 'Unable to load winners.';
    context.log({ operation: 'winners.get', competitionId, status, error: message });
    return { status, jsonBody: { error: message } };
  }
}

app.http('winners', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/winners',
  handler: winners,
});
