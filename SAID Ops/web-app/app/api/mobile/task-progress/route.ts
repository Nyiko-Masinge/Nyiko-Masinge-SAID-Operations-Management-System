import { progressStore } from '../../../../lib/server/admin';
import { PublicationError } from '../../../../lib/server/publication';
import { progressTrusted } from '../../../../lib/server/taskProgress';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    if (!/^Bearer (\S+)$/.test(request.headers.get('authorization') ?? '')) throw new PublicationError(401, 'Sign in before updating task progress.');
    if (Number(request.headers.get('content-length')) > 64_000) throw new PublicationError(413, 'Progress payload is too large.');
    const raw = await request.text();
    if (raw.length > 64_000) throw new PublicationError(413, 'Progress payload is too large.');
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new PublicationError(400, 'Invalid progress JSON.'); }
    return Response.json(await progressTrusted(request.headers.get('authorization'), input, progressStore()));
  } catch (error) {
    const expected = error instanceof PublicationError;
    return Response.json({ error: expected ? error.message : 'Could not save task progress. Retry or refresh the roster.',
      code: expected ? error.code : 'PROGRESS_FAILED' }, { status: expected ? error.status : 500 });
  }
}
