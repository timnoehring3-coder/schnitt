// POST /api/license/activate|validate|deactivate  {key, instanceName|instanceId} — von engine/lib/license.mjs aufgerufen.
import { activate, validate, deactivate } from '../../../../lib/license.js';
export const runtime = 'nodejs';

export async function POST(req, { params }) {
  const { action } = await params;
  let body = {};
  try { body = await req.json(); } catch { /* leer */ }
  try {
    if (action === 'activate') return Response.json(await activate(body.key, body.instanceName));
    if (action === 'validate') return Response.json(await validate(body.key, body.instanceId));
    if (action === 'deactivate') return Response.json(await deactivate(body.key, body.instanceId));
    return Response.json({ error: 'unbekannte Aktion' }, { status: 404 });
  } catch (e) {
    const soft = /Schlüssel|Signatur/.test(e.message);
    return Response.json({ error: e.message, activated: false, valid: false }, { status: soft ? 400 : 500 });
  }
}
