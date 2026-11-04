import { createFileRoute } from "@tanstack/react-router";
import { proxyRequest, resolveSite } from "@/lib/site-proxy.server";

function pathOf(request: Request) {
  const url = new URL(request.url);
  return url.pathname + url.search;
}

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyRequest(request, pathOf(request), resolveSite(request)),
      POST: ({ request }) => proxyRequest(request, pathOf(request), resolveSite(request)),
    },
  },
});
