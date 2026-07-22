import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAdmin, requireUser, isAuthError } from '../shared/auth';

export async function me(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const principal = requireUser(request);
  if (isAuthError(principal)) {
    context.log({ operation: 'me.get', authenticated: false });
    return principal;
  }

  context.log({
    operation: 'me.get',
    authenticated: true,
    userId: principal.userId,
  });
  return {
    status: 200,
    jsonBody: {
      userId: principal.userId,
      userDetails: principal.userDetails,
      isAdmin: isAdmin(principal),
    },
  };
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: me,
});
