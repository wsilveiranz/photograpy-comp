import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAuthError, requireAdmin } from '../shared/auth';
import {
  CompetitionError,
  createCompetition,
  getCompetition,
  toCompetitionView,
  updateStatus,
  type CompetitionStatusAction,
} from '../shared/competitions';
import { getCompetitionStats } from '../shared/competition-stats';

export async function adminCompetitions(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireAdmin(request);
  if (isAuthError(principal)) {
    context.log({
      operation: 'adminCompetitions.authorize',
      competitionId: request.params.id,
      status: principal.status,
    });
    return principal;
  }

  if (request.method === 'POST' && !request.params.id) {
    return create(request, context, principal.userId);
  }
  if (request.method === 'GET' && request.params.id) {
    return getSummary(context, principal.userId, request.params.id);
  }
  if (request.method === 'PATCH' && request.params.id) {
    return changeStatus(request, context, principal.userId, request.params.id);
  }

  return { status: 405, jsonBody: { error: 'Method not allowed for this route.' } };
}

app.http('admin-competitions', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  route: 'manage/competitions/{id?}',
  handler: adminCompetitions,
});

async function getSummary(
  context: InvocationContext,
  adminId: string,
  competitionId: string,
): Promise<HttpResponseInit> {
  const operation = 'adminCompetitions.getSummary';
  try {
    const record = await getCompetition(competitionId);
    if (!record) {
      context.log({ operation, competitionId, adminId, found: false });
      return { status: 404, jsonBody: { error: 'Competition not found.' } };
    }

    const [competition, stats] = await Promise.all([
      toCompetitionView(record),
      getCompetitionStats(competitionId),
    ]);
    context.log({ operation, competitionId, adminId, found: true });
    return { status: 200, jsonBody: { competition, stats } };
  } catch (error) {
    context.log({ operation, competitionId, adminId, error: errorMessage(error) });
    return {
      status: 500,
      jsonBody: { error: 'Unable to retrieve the competition summary.' },
    };
  }
}

async function create(
  request: HttpRequest,
  context: InvocationContext,
  adminId: string,
): Promise<HttpResponseInit> {
  const operation = 'adminCompetitions.create';
  try {
    const body = await readJsonRecord(request);
    if (!body) {
      return { status: 400, jsonBody: { error: 'A JSON request body is required.' } };
    }

    const record = await createCompetition({
      name: stringValue(body.name),
      prizeDescription: stringValue(body.prizeDescription),
    });
    const view = await toCompetitionView(record);
    context.log({ operation, competitionId: record.id, adminId });
    return { status: 201, jsonBody: view };
  } catch (error) {
    return competitionErrorResponse(error, context, operation, adminId);
  }
}

async function changeStatus(
  request: HttpRequest,
  context: InvocationContext,
  adminId: string,
  competitionId: string,
): Promise<HttpResponseInit> {
  const operation = 'adminCompetitions.updateStatus';
  try {
    const body = await readJsonRecord(request);
    const action = parseStatusAction(body);
    if (!action) {
      return {
        status: 400,
        jsonBody: {
          error:
            'Action must be openVoting, toTiebreak, close, or forceClose. Voting dates are required for openVoting.',
        },
      };
    }

    const record = await updateStatus(competitionId, action);
    const view = await toCompetitionView(record);
    context.log({ operation, competitionId, adminId, action: action.action });
    return { status: 200, jsonBody: view };
  } catch (error) {
    return competitionErrorResponse(error, context, operation, adminId, competitionId);
  }
}

function parseStatusAction(value: unknown): CompetitionStatusAction | null {
  if (!isRecord(value) || typeof value.action !== 'string') {
    return null;
  }

  if (value.action === 'openVoting') {
    if (typeof value.votingStartsAt !== 'string' || typeof value.votingEndsAt !== 'string') {
      return null;
    }
    return {
      action: value.action,
      votingStartsAt: value.votingStartsAt,
      votingEndsAt: value.votingEndsAt,
    };
  }

  if (
    value.action === 'toTiebreak' ||
    value.action === 'close' ||
    value.action === 'forceClose'
  ) {
    return { action: value.action };
  }

  return null;
}

function competitionErrorResponse(
  error: unknown,
  context: InvocationContext,
  operation: string,
  adminId: string,
  competitionId?: string,
): HttpResponseInit {
  context.log({ operation, adminId, competitionId, error: errorMessage(error) });
  if (error instanceof CompetitionError) {
    const status =
      error.code === 'competition_not_found'
        ? 404
        : error.code === 'active_competition_exists' || error.code === 'invalid_transition'
          ? 409
          : 400;
    return { status, jsonBody: { error: error.message } };
  }
  return { status: 500, jsonBody: { error: 'Unable to update the competition.' } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function readJsonRecord(request: HttpRequest): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
