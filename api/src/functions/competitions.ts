import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  getCompetition,
  listCompetitions,
  toCompetitionView,
} from '../shared/competitions';

export async function competitions(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const competitionId = request.params.id;

  try {
    if (competitionId) {
      const record = await getCompetition(competitionId);
      if (!record) {
        context.log({ operation: 'competitions.get', competitionId, found: false });
        return { status: 404, jsonBody: { error: 'Competition not found.' } };
      }

      const view = await toCompetitionView(record);
      context.log({ operation: 'competitions.get', competitionId, found: true });
      return { status: 200, jsonBody: view };
    }

    const records = await listCompetitions();
    const views = await Promise.all(records.map(toCompetitionView));
    context.log({ operation: 'competitions.list', count: views.length });
    return { status: 200, jsonBody: views };
  } catch (error) {
    context.log({
      operation: competitionId ? 'competitions.get' : 'competitions.list',
      competitionId,
      error: errorMessage(error),
    });
    return { status: 500, jsonBody: { error: 'Unable to retrieve competitions.' } };
  }
}

app.http('competitions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'competitions/{id?}',
  handler: competitions,
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
