import { archiveStore } from '../../../../lib/server/admin';
import { archiveTrusted } from '../../../../lib/server/archive';
import { PublicationError } from '../../../../lib/server/publication';
export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length > 4000) throw new PublicationError(413, 'Archive payload is too large.');
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new PublicationError(400, 'Invalid archive JSON.'); }
    return Response.json(await archiveTrusted(request.headers.get('authorization'), payload, archiveStore()));
  } catch (error) {
    const expected = error instanceof PublicationError;
    return Response.json({ error: expected ? error.message : 'Could not archive the roster. Refresh and retry.', code: expected ? error.code : 'ARCHIVE_FAILED' }, { status: expected ? error.status : 500 });
  }
}
