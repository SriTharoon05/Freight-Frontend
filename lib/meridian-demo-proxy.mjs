// Fixed, controller-only bridge for the embedded client presentation.
// No company credentials, cookies, production endpoints or driver GPS pass here.
const upstream = 'https://freight-partners-api.onrender.com/v1/demo/';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = {'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const error = (detail, status) => Response.json({detail},{status,headers:noStore});

export async function forwardDemo(request, segments, fetcher = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  // Next can construct an internal localhost URL behind a reverse proxy. Host is
  // the browser-facing request authority; no forwarded credentials are trusted.
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.slice(0,-1);
  const browserOrigin = `${protocol}://${request.headers.get('host') || url.host}`;
  if (origin && origin !== url.origin && origin !== browserOrigin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return error('Open the Meridian demo in its own website.',403);
  }
  if (url.search || segments[0] !== 'sessions') return error('Demo endpoint not found.',404);
  const create = segments.length === 1;
  const session = segments.length >= 2 && uuid.test(segments[1]);
  const readOrEnd = session && segments.length === 2 && ['GET','DELETE'].includes(request.method);
  const command = session && segments.length === 3 && ['accept','assign','job'].includes(segments[2]) && request.method === 'POST';
  const photo = session && segments.length === 5 && segments[2] === 'proofs' && uuid.test(segments[3]) && segments[4] === 'content' && request.method === 'GET';
  if (!(create && request.method === 'POST' || readOrEnd || command || photo)) return error('Demo endpoint not found.',404);
  const headers = {'Content-Type':'application/json'};
  if (!create) {
    const token = request.headers.get('authorization') || '';
    if (!/^Bearer demo_c_[A-Za-z0-9_-]{43}$/.test(token)) return error('Start a Meridian live trip first.',401);
    headers.Authorization = token;
  }
  let body;
  if (request.method === 'POST') {
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return error('Use a JSON demo command.',415);
    if (Number(request.headers.get('content-length')) > 4096) return error('Demo command is too large.',413);
    body = await request.text();
    if (new TextEncoder().encode(body).length > 4096) return error('Demo command is too large.',413);
    if (create) body = undefined;
  }
  try {
    const response = await fetcher(upstream + segments.join('/'), {
      method:request.method, headers, body, cache:'no-store', redirect:'error',
      signal:AbortSignal.timeout(25000),
    });
    if (response.status === 204) return new Response(null,{status:204,headers:noStore});
    if (photo && response.ok && (response.headers.get('content-type') || '').split(';')[0] === 'image/jpeg') {
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 49152) return error('Photo is too large.',503);
      return new Response(bytes,{status:200,headers:{...noStore,'Content-Type':'image/jpeg'}});
    }
    if (!(response.headers.get('content-type') || '').includes('application/json')) return error('Live trips are waking up. Please try again in a moment.',503);
    const content = await response.text();
    if (content.length > 100000) return error('The live demo response is unavailable. Please retry.',503);
    return new Response(content, {status:response.status, headers:{...noStore,'Content-Type':'application/json',...(response.headers.has('retry-after')?{'Retry-After':response.headers.get('retry-after')}:{})}});
  } catch {
    return error('Live trips are waking up. Please try again in a moment.',503);
  }
}
