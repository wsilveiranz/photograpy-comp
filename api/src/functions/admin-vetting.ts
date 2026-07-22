import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { isAuthError, requireAdmin } from '../shared/auth';
import {
  EntryServiceError,
  listEntriesForCompetition,
  reviewEntry,
  type ReviewDecision,
} from '../shared/entries';

export async function getVettingEntries(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireAdmin(request);
  if (isAuthError(principal)) {
    return principal;
  }

  const competitionId = request.params.id ?? '';
  try {
    const entries = await listEntriesForCompetition(competitionId, { includeAll: true });
    context.log({
      operation: 'adminVetting.list',
      outcome: 'success',
      competitionId,
      userId: principal.userId,
      count: entries.length,
    });
    return { status: 200, jsonBody: entries };
  } catch {
    context.log({
      operation: 'adminVetting.list',
      outcome: 'failed',
      competitionId,
      userId: principal.userId,
    });
    return { status: 500, jsonBody: { error: 'Unable to list entries for vetting.' } };
  }
}

export async function patchVettingEntry(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireAdmin(request);
  if (isAuthError(principal)) {
    return principal;
  }

  const entryId = request.params.entryId ?? '';
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: 'A JSON request body is required.' } };
  }
  if (!isReviewBody(body)) {
    return {
      status: 400,
      jsonBody: { error: 'competitionId and a decision of approved or rejected are required.' },
    };
  }

  try {
    const entry = await reviewEntry(
      body.competitionId.trim(),
      entryId,
      body.decision,
      principal.userId,
    );
    context.log({
      operation: 'adminVetting.review',
      outcome: 'success',
      competitionId: body.competitionId,
      entryId,
      userId: principal.userId,
      decision: body.decision,
    });
    return { status: 200, jsonBody: entry };
  } catch (error: unknown) {
    const status = error instanceof EntryServiceError ? error.status : 500;
    context.log({
      operation: 'adminVetting.review',
      outcome: status < 500 ? 'rejected' : 'failed',
      competitionId: body.competitionId,
      entryId,
      userId: principal.userId,
      status,
    });
    return {
      status,
      jsonBody: {
        error:
          error instanceof EntryServiceError
            ? error.message
            : 'Unable to review the entry.',
      },
    };
  }
}

interface ReviewBody {
  competitionId: string;
  decision: ReviewDecision;
}

function isReviewBody(value: unknown): value is ReviewBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.competitionId === 'string' &&
    body.competitionId.trim().length > 0 &&
    (body.decision === 'approved' || body.decision === 'rejected')
  );
}

app.http('adminCompetitionEntries', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/competitions/{id}/entries',
  handler: getVettingEntries,
});

app.http('adminReviewEntry', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'manage/entries/{entryId}',
  handler: patchVettingEntry,
});
