import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAuthError, requireAdmin } from '../shared/auth';
import {
  CompetitionError,
  setPrize,
  toCompetitionView,
} from '../shared/competitions';
import { MAX_IMAGE_SIZE_BYTES } from '../shared/validation';

interface PrizeRequest {
  image: Buffer;
  contentType: string;
  description: string;
}

export async function adminCompetitionPrize(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const competitionId = request.params.id;
  const principal = requireAdmin(request);
  if (isAuthError(principal)) {
    context.log({
      operation: 'adminCompetitionPrize.authorize',
      competitionId,
      status: principal.status,
    });
    return principal;
  }
  if (!competitionId) {
    return { status: 400, jsonBody: { error: 'Competition id is required.' } };
  }

  const operation = 'adminCompetitionPrize.set';
  try {
    const prize = await parsePrizeRequest(request);
    const record = await setPrize(
      competitionId,
      prize.image,
      prize.contentType,
      prize.description,
    );
    const view = await toCompetitionView(record);
    context.log({
      operation,
      competitionId,
      adminId: principal.userId,
      sizeBytes: prize.image.length,
    });
    return { status: 200, jsonBody: view };
  } catch (error) {
    context.log({
      operation,
      competitionId,
      adminId: principal.userId,
      error: errorMessage(error),
    });
    if (error instanceof CompetitionError) {
      return {
        status: error.code === 'competition_not_found' ? 404 : 400,
        jsonBody: { error: error.message },
      };
    }
    if (error instanceof PrizeRequestError) {
      return { status: 400, jsonBody: { error: error.message } };
    }
    return { status: 500, jsonBody: { error: 'Unable to set the competition prize.' } };
  }
}

app.http('admin-competition-prize', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/competitions/{id}/prize',
  handler: adminCompetitionPrize,
});

class PrizeRequestError extends Error {}

async function parsePrizeRequest(request: HttpRequest): Promise<PrizeRequest> {
  const requestContentType = request.headers.get('content-type') ?? '';
  if (requestContentType.toLowerCase().startsWith('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new PrizeRequestError('Unable to parse the multipart request body.');
    }
    const image = form.get('image');
    const description = form.get('description');
    if (
      !image ||
      typeof image === 'string' ||
      typeof image.arrayBuffer !== 'function' ||
      typeof description !== 'string'
    ) {
      throw new PrizeRequestError('Multipart fields image and description are required.');
    }

    const imageContentType = image.type || stringFormValue(form.get('contentType'));
    if (!imageContentType) {
      throw new PrizeRequestError('Image content type is required.');
    }
    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      throw new PrizeRequestError('Image exceeds the 25 MB limit.');
    }

    return {
      image: Buffer.from(await image.arrayBuffer()),
      contentType: imageContentType,
      description,
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PrizeRequestError('Unable to parse the JSON request body.');
  }
  if (
    !isRecord(body) ||
    typeof body.imageBase64 !== 'string' ||
    typeof body.contentType !== 'string' ||
    typeof body.description !== 'string'
  ) {
    throw new PrizeRequestError(
      'JSON fields imageBase64, contentType, and description are required.',
    );
  }

  const encoded = body.imageBase64.replace(/\s/g, '');
  const maximumEncodedLength = Math.ceil((MAX_IMAGE_SIZE_BYTES * 4) / 3) + 4;
  if (
    encoded.length === 0 ||
    encoded.length > maximumEncodedLength ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  ) {
    throw new PrizeRequestError('Image must be valid base64 within the 25 MB limit.');
  }

  return {
    image: Buffer.from(encoded, 'base64'),
    contentType: body.contentType,
    description: body.description,
  };
}

function stringFormValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
