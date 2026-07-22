import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAuthError, requireAdmin } from '../shared/auth';
import {
  castTieBreak,
  getTieBreak,
  resolveWinner,
  ResultsError,
} from '../shared/results';

export async function tiebreak(
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
    if (request.method === 'GET') {
      const data = await getTieBreak(competitionId);
      context.log({ operation: 'tiebreak.get', competitionId, userId: principal.userId });
      return { status: 200, jsonBody: data };
    }

    const body = await request.json();
    const entryId =
      typeof body === 'object' && body !== null && 'entryId' in body && typeof body.entryId === 'string'
        ? body.entryId
        : null;
    if (!entryId) {
      return { status: 400, jsonBody: { error: 'entryId is required.' } };
    }
    const data = await castTieBreak(competitionId, principal.userId, entryId);
    context.log({ operation: 'tiebreak.cast', competitionId, entryId, userId: principal.userId });
    return { status: 200, jsonBody: data };
  } catch (error) {
    return respondWithError(error, context, competitionId, principal.userId, 'tiebreak');
  }
}

export async function resolve(
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
    const winnerId = await resolveWinner(competitionId, principal.userId);
    context.log({ operation: 'tiebreak.resolve', competitionId, entryId: winnerId, userId: principal.userId });
    return { status: 200, jsonBody: { winnerId } };
  } catch (error) {
    return respondWithError(error, context, competitionId, principal.userId, 'tiebreak.resolve');
  }
}

app.http('tiebreak', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'manage/competitions/{id}/tiebreak',
  handler: tiebreak,
});

app.http('resolve', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/competitions/{id}/resolve',
  handler: resolve,
});

function respondWithError(
  error: unknown,
  context: InvocationContext,
  competitionId: string,
  userId: string,
  operation: string,
): HttpResponseInit {
  const status = error instanceof ResultsError ? error.status : 500;
  const message = error instanceof ResultsError ? error.message : 'Unable to process the tie-break.';
  context.log({ operation, competitionId, userId, status, error: message });
  return { status, jsonBody: { error: message } };
}
