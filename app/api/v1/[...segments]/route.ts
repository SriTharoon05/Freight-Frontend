const DEFAULT_UPSTREAM = "https://freight-backend-fibk.onrender.com/api/v1";

const FORWARDED_REQ_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-requested-with",
  "idempotency-key",
  "if-none-match",
  "if-match",
];

const FORWARDED_RES_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "retry-after",
  "x-request-id",
  "etag",
];

async function proxyApi(
  request: Request,
  context: { params: Promise<{ segments: string[] }> },
): Promise<Response> {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json(
      { detail: "Cross-site API requests are not permitted." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { segments } = await context.params;
  const url = new URL(request.url);
  const upstreamBase = (
    process.env.BACKEND_API_BASE_URL || DEFAULT_UPSTREAM
  ).replace(/\/+$/, "");

  const safePath = (segments || [])
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const targetUrl = `${upstreamBase}/${safePath}${url.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQ_HEADERS) {
    const val = request.headers.get(name);
    if (val) headers.set(name, val);
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstreamResp = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    const outHeaders = new Headers({
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of FORWARDED_RES_HEADERS) {
      const val = upstreamResp.headers.get(name);
      if (val) outHeaders.set(name, val);
    }
    if (!outHeaders.has("cache-control")) {
      outHeaders.set("Cache-Control", "no-store");
    }

    if (upstreamResp.status === 204) {
      return new Response(null, { status: 204, headers: outHeaders });
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: outHeaders,
    });
  } catch {
    return Response.json(
      {
        detail:
          "Freight backend is waking up or temporarily unreachable. Please retry in a few seconds.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxyApi;
export const POST = proxyApi;
export const PUT = proxyApi;
export const PATCH = proxyApi;
export const DELETE = proxyApi;
