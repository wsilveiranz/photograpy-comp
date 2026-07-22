import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { isAuthError, requireUser } from '../shared/auth';
import {
  EntryServiceError,
  listMyEntries,
  uploadEntry,
} from '../shared/entries';

export async function createEntry(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireUser(request);
  if (isAuthError(principal)) {
    return principal;
  }

  const competitionId = request.params.id ?? '';
  try {
    const form = await request.formData();
    const file = form.get('file');
    const title = form.get('title');
    if (
      !file ||
      typeof file === 'string' ||
      typeof file.arrayBuffer !== 'function'
    ) {
      return { status: 400, jsonBody: { error: 'An image file is required.' } };
    }
    if (typeof title !== 'string') {
      return { status: 400, jsonBody: { error: 'Title is required.' } };
    }

    const entry = await uploadEntry(
      competitionId,
      principal,
      Buffer.from(await file.arrayBuffer()),
      file.type,
      title,
      context,
    );
    context.log({
      operation: 'entries.upload',
      outcome: 'created',
      competitionId,
      entryId: entry.id,
      userId: principal.userId,
      flagged: entry.flagged,
    });
    return { status: 201, jsonBody: entry };
  } catch (error: unknown) {
    return handleEntryError(error, context, {
      operation: 'entries.upload',
      competitionId,
      userId: principal.userId,
    });
  }
}

export async function getMyEntries(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireUser(request);
  if (isAuthError(principal)) {
    return principal;
  }

  const competitionId = request.params.id ?? '';
  try {
    const entries = await listMyEntries(competitionId, principal.userId);
    context.log({
      operation: 'entries.listMine',
      outcome: 'success',
      competitionId,
      userId: principal.userId,
      count: entries.length,
    });
    return { status: 200, jsonBody: entries };
  } catch (error: unknown) {
    return handleEntryError(error, context, {
      operation: 'entries.listMine',
      competitionId,
      userId: principal.userId,
    });
  }
}

function handleEntryError(
  error: unknown,
  context: InvocationContext,
  details: Record<string, unknown>,
): HttpResponseInit {
  if (error instanceof EntryServiceError) {
    context.log({ ...details, outcome: 'rejected', status: error.status });
    return { status: error.status, jsonBody: { error: error.message } };
  }
  context.log({ ...details, outcome: 'failed' });
  return { status: 500, jsonBody: { error: 'Unable to process the entry request.' } };
}

app.http('competitionEntries', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/entries',
  handler: createEntry,
});

app.http('myCompetitionEntries', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id}/my-entries',
  handler: getMyEntries,
});
