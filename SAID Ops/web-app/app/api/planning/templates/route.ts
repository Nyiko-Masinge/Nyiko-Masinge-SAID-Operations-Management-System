import { planningStore } from '../../../../lib/server/admin';
import { writeTemplate } from '../../../../lib/server/planning';
import { planningResponse } from '../../../../lib/server/planningRoute';
export const runtime = 'nodejs';
export const POST = (request: Request) => planningResponse(request, writeTemplate, planningStore);
