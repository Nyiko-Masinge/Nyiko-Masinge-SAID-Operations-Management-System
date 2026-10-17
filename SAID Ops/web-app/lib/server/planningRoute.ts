import { PlanningError, type PlanningStore } from './planning';
import { PublicationError } from './publication';

export async function planningResponse(request: Request, handler: (authorization: string | null, input: unknown, store: PlanningStore) => Promise<Record<string, unknown>>, store: () => PlanningStore): Promise<Response> {
  try {
    if (Number(request.headers.get('content-length')) > 32_000) throw new PlanningError(413, 'Planning payload is too large.');
    const raw = await request.text();
    if (raw.length > 32_000) throw new PlanningError(413, 'Planning payload is too large.');
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new PlanningError(400, 'Invalid planning JSON.'); }
    const result = await handler(request.headers.get('authorization'), payload, store());
    return Response.json(result);
  } catch (error) {
    const expected = error instanceof PlanningError || error instanceof PublicationError;
    return Response.json({ error: expected ? error.message : 'Planning save failed. Check your connection, reload and retry.' }, { status: expected ? error.status : 500 });
  }
}
