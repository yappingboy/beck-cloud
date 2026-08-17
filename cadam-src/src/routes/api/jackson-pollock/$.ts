import { createFileRoute } from '@tanstack/react-router';
import { preflight } from '@/server/api';

const POSTHOG_API_HOST = 'us.i.posthog.com';
const POSTHOG_ASSET_HOST = 'us-assets.i.posthog.com';

export const Route = createFileRoute('/api/jackson-pollock/$')({
  server: {
    handlers: {
      GET: proxyPostHog,
      POST: proxyPostHog,
      OPTIONS: preflight,
    },
  },
});

async function proxyPostHog({ request }: { request: Request }) {
  const url = new URL(request.url);
  const routePath = '/api/jackson-pollock';
  const routeIndex = url.pathname.indexOf(routePath);
  const path =
    routeIndex === -1
      ? '/'
      : url.pathname.slice(routeIndex + routePath.length) || '/';
  const hostname = path.startsWith('/static/')
    ? POSTHOG_ASSET_HOST
    : POSTHOG_API_HOST;
  const nextUrl = new URL(url);
  nextUrl.protocol = 'https';
  nextUrl.hostname = hostname;
  nextUrl.port = '';
  nextUrl.pathname = path;

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body =
    request.method === 'GET' ? undefined : await request.arrayBuffer();
  const response = await fetch(nextUrl, {
    method: request.method,
    headers,
    body,
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
