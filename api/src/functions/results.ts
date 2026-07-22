import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAuthError, requireAdmin } from '../shared/auth';
import { getResults, ResultsError } from '../shared/results';

export async function results(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireAdmin(request);
  if (isAuthError(principal)) {
    return principal;
  }

  const competitionId = request.params.id;
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required.' } };
  }

  try {
    const data = await getResults(competitionId);
    context.log({ operation: 'results.get', competitionId, userId: principal.userId });
    return { status: 200, jsonBody: data };
  } catch (error) {
    return respondWithError(error, context, competitionId, principal.userId, 'results.get');
  }
}

app.http('results', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/results',
  handler: results,
});

function respondWithError(
  error: unknown,
  context: InvocationContext,
  competitionId: string,
  userId: string,
  operation: string,
): HttpResponseInit {
  const status = error instanceof ResultsError ? error.status : 500;
  const message = error instanceof ResultsError ? error.message : 'Unable to load results.';
  context.log({ operation, competitionId, userId, status, error: message });
  return { status, jsonBody: { error: message } };
}
