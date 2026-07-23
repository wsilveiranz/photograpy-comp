import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getDisplayName, isAdmin, isApproved, parseClientPrincipal } from '../shared/auth';

export async function me(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = parseClientPrincipal(request);
  if (!principal) {
    context.log({ operation: 'me.get', authenticated: false });
    return { status: 401, jsonBody: { error: 'Authentication required' } };
  }

  const approved = isApproved(principal);
  context.log({
    operation: 'me.get',
    authenticated: true,
    userId: principal.userId,
    approved,
  });
  return {
    status: 200,
    jsonBody: {
      userId: principal.userId,
      userDetails: principal.userDetails,
      displayName: getDisplayName(principal),
      isAdmin: isAdmin(principal),
      isApproved: approved,
    },
  };
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: me,
});
