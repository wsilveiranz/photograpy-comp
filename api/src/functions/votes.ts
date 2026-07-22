import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAuthError, requireUser } from '../shared/auth';
import {
  castVote,
  getRemainingTokens,
  listMyVotes,
  removeVote,
  VoteError,
} from '../shared/votes';

export async function votes(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireUser(request);
  if (isAuthError(principal)) {
    context.log({ operation: 'votes.request', authenticated: false });
    return principal;
  }

  const competitionId = request.params.id;
  const entryId = request.params.entryId;
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required' } };
  }

  if (request.method === 'POST') {
    const body = await getVoteBody(request);
    if (!body) {
      return { status: 400, jsonBody: { error: 'entryId is required' } };
    }
    return changeVote('cast', competitionId, principal.userId, body.entryId, context);
  }

  if (request.method === 'DELETE' && entryId) {
    return changeVote('remove', competitionId, principal.userId, entryId, context);
  }

  return { status: 400, jsonBody: { error: 'entryId is required' } };
}

export async function myVotes(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireUser(request);
  if (isAuthError(principal)) {
    context.log({ operation: 'votes.listMine', authenticated: false });
    return principal;
  }

  const competitionId = request.params.id;
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required' } };
  }

  try {
    const [entryIds, remaining] = await Promise.all([
      listMyVotes(competitionId, principal.userId),
      getRemainingTokens(competitionId, principal.userId),
    ]);
    context.log({ operation: 'votes.listMine', competitionId, userId: principal.userId });
    return { status: 200, jsonBody: { entryIds, remaining } };
  } catch (error) {
    context.log({
      operation: 'votes.listMine.failed',
      competitionId,
      userId: principal.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { status: 500, jsonBody: { error: 'Unable to load votes' } };
  }
}

async function changeVote(
  action: 'cast' | 'remove',
  competitionId: string,
  userId: string,
  entryId: string,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    if (action === 'cast') {
      await castVote(competitionId, userId, entryId);
    } else {
      await removeVote(competitionId, userId, entryId);
    }
    const remaining = await getRemainingTokens(competitionId, userId);
    context.log({ operation: `votes.${action}`, competitionId, userId, entryId });
    return { status: 200, jsonBody: { remaining } };
  } catch (error) {
    if (error instanceof VoteError) {
      context.log({
        operation: `votes.${action}.rejected`,
        competitionId,
        userId,
        entryId,
        reason: error.code,
      });
      return { status: voteErrorStatus(error.code), jsonBody: { error: error.code } };
    }
    context.log({
      operation: `votes.${action}.failed`,
      competitionId,
      userId,
      entryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { status: 500, jsonBody: { error: 'Unable to update vote' } };
  }
}

async function getVoteBody(request: HttpRequest): Promise<{ entryId: string } | null> {
  try {
    const body: unknown = await request.json();
    return isVoteBody(body) ? body : null;
  } catch {
    return null;
  }
}

function isVoteBody(value: unknown): value is { entryId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'entryId' in value &&
    typeof value.entryId === 'string' &&
    value.entryId.length > 0
  );
}

function voteErrorStatus(code: VoteError['code']): number {
  return code === 'entry-not-approved' ? 404 : 409;
}

app.http('votes', {
  methods: ['POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/votes/{entryId?}',
  handler: votes,
});

app.http('my-votes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/my-votes',
  handler: myVotes,
});
