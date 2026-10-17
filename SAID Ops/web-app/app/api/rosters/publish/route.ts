import { publicationStore } from '../../../../lib/server/admin';
import { PublicationError, publishTrusted } from '../../../../lib/server/publication';

export const runtime = 'nodejs';
// Code Attribution — Aaryan Makan (ST10259834), publication HTTP boundary.
// This handler follows Next.js App Router's exported POST and Request/Response API.
// Vercel (n.d.) 'File-system conventions: route.js'.
// https://nextjs.org/docs/app/api-reference/file-conventions/route
// Accessed: 5 October 2026.
export async function POST(request: Request): Promise<Response> {
  try {
    if (Number(request.headers.get('content-length')) > 2_000_000) throw new PublicationError(413,'Publication payload is too large.');
    const raw = await request.text();
    if (raw.length > 2_000_000) throw new PublicationError(413,'Publication payload is too large.');
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new PublicationError(400,'Invalid publication JSON.'); }
    const result = await publishTrusted(request.headers.get('authorization'),payload,publicationStore());
    return Response.json(result);
  } catch (error) {
    const expected = error instanceof PublicationError;
    return Response.json({error:expected ? error.message : 'Publication failed. The previous current roster was not replaced. Retry after checking the server connection.',
      code: expected ? error.code : 'PUBLICATION_FAILED', ...(expected && error.coverageIssues.length ? { coverageIssues: error.coverageIssues } : {})},{status:expected ? error.status : 500});
  }
}
