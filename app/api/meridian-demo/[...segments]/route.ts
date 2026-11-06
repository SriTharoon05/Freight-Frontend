import { forwardDemo } from '../../../../lib/meridian-demo-proxy.mjs';

async function handle(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  return forwardDemo(request, segments);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
